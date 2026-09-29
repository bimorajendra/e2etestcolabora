import path from 'node:path';
import type { APIRequestContext, Browser, Page } from '@playwright/test';
import { test, expect, API_ORIGIN, isSafeEnv } from '../fixtures/test';
import { getAccount } from '../fixtures/accounts';
import { LoginPage } from '../fixtures/pages';

// Drives one permohonan through the whole PB/PD workflow in the UI, from
// "Permohonan baru" to "Selesai". WRITES REAL DATA (a permohonan, uploaded
// evidence, every workflow activity), so it only runs with E2E_SAFE_ENV=true.
// Created customers are named "E2E Flow ..." so they can be told apart.
//
// Which role acts next is read from the API (`available_actions` on
// GET /api/permohonan/:id with that role's token), so the test follows the
// real routing instead of hard-coding the branch order.

const EVIDENCE = path.resolve(__dirname, '../fixtures/files/e2e-evidence.pdf');
const ROLES = [
  'pelayanan-taman', 'pelayanan-menganti', 'pelayanan-pilang', 'nps-up',
  'teknik-taman', 'teknik-menganti', 'teknik-pilang', 'perencanaan-up', 'konstruksi-up', 'transaksi-up',
  'jaringan-up', 'pdkb-up', 'vendor-tiang', 'vendor-konstruksi', 'vendor-srapp',
];

type Action = { workflow_node: string; path: string; method: string };
type WorkflowNode = { workflow_node: string; status: string };
type Permohonan = {
  id: string; no_permohonan: string; status: string; current_stage: number;
  kebutuhan_tiang: boolean | null; perlu_pdkb: boolean | null;
  workflow_nodes: WorkflowNode[]; available_actions: Action[];
};

/** Answers for the decision comboboxes, keyed by their accessible name. */
type Decisions = Record<string, string>;

class Api {
  private tokens = new Map<string, string>();
  constructor(private request: APIRequestContext) {}

  async token(role: string) {
    if (!this.tokens.has(role)) {
      const a = getAccount(role);
      if (!a) return undefined;
      const res = await this.request.post(`${API_ORIGIN}/api/auth/login`, { data: { email: a.email, password: a.password } });
      expect(res.ok(), `API login ${role}`).toBeTruthy();
      this.tokens.set(role, (await res.json()).data.access_token);
    }
    return this.tokens.get(role);
  }

  async permohonan(id: string, role = 'super-user'): Promise<Permohonan> {
    const res = await this.request.get(`${API_ORIGIN}/api/permohonan/${id}`, {
      headers: { authorization: `Bearer ${await this.token(role)}` },
    });
    expect(res.ok(), `GET permohonan as ${role}`).toBeTruthy();
    return (await res.json()).data;
  }

  async documents(id: string) {
    const res = await this.request.get(`${API_ORIGIN}/api/permohonan/${id}/documents`, {
      headers: { authorization: `Bearer ${await this.token('super-user')}` },
    });
    return (await res.json()).data as { original_filename: string; workflow_nodes: string[] }[];
  }

  /** The first role that currently has an action on the permohonan. */
  async nextActor(id: string) {
    for (const role of ROLES) {
      if (!(await this.token(role))) continue;
      // Roles of another ULP are denied access to this permohonan; that is expected.
      const res = await this.request.get(`${API_ORIGIN}/api/permohonan/${id}`, {
        headers: { authorization: `Bearer ${await this.token(role)}` },
      });
      if (!res.ok()) continue;
      const actions: Action[] = (await res.json()).data.available_actions ?? [];
      if (actions.length) return { role, actions };
    }
    return undefined;
  }
}

/** One logged-in tab per role (the session lives in sessionStorage, per tab). */
class Sessions {
  private pages = new Map<string, Page>();
  constructor(private browser: Browser, private baseURL: string, private api: Api) {}

  async page(role: string) {
    const existing = this.pages.get(role);
    if (existing) return existing;
    const context = await this.browser.newContext({ baseURL: this.baseURL });
    // WORKAROUND for BUG-WF-001: the vendor dropdown on the WO forms loads
    // GET /api/user, which is admin-only, so it is empty for perencanaan,
    // konstruksi and transaksi and the WO step cannot be completed. The
    // request is replayed with a super-user token so the rest of the flow
    // can still be tested; tests/workflow/vendor-list.spec.ts covers the bug.
    const su = await this.api.token('super-user');
    await context.route(/\/api\/user\?/, async (route) => {
      const response = await route.fetch({ headers: { ...route.request().headers(), authorization: `Bearer ${su}` } });
      await route.fulfill({ response });
    });
    const page = await context.newPage();
    const account = getAccount(role)!;
    await new LoginPage(page).login(account.email, account.password);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    this.pages.set(role, page);
    return page;
  }

  async close() {
    for (const p of this.pages.values()) await p.context().close();
  }
}

/** Confirms the "Lanjutkan aktivitas?" / "Buat permohonan baru?" alertdialog. */
async function confirmDialog(page: Page) {
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button').last().click();
}

/** Choices on the create form, keyed by combobox name ("Jenis permohonan", "Jenis sambungan", "Unit / ULP"). */
type CreateChoices = Record<string, string>;

async function createPermohonan(page: Page, customer: string, choices: CreateChoices) {
  await page.goto('/permohonan/baru');
  await expect(page.getByRole('heading', { level: 1, name: 'Permohonan PB/PD baru' })).toBeVisible();
  await page.getByLabel('Nama pelanggan').fill(customer);
  await page.getByLabel('No. HP / telepon').fill('081234567890');
  await page.getByLabel('Lokasi').fill('Jl. E2E Test No. 1, Surabaya');
  for (const [label, option] of Object.entries(choices)) {
    const combo = page.getByRole('combobox', { name: label, exact: true });
    await combo.click();
    await page.getByRole('option', { name: option, exact: true }).click();
    await expect(combo).toHaveText(option);
  }
  // Since the 2026-09 release the form also requires Tarif -> Permohonan daya (dependent list)
  // and at least one evidence file.
  const tarif = page.getByRole('combobox', { name: 'Tarif', exact: true });
  await expect(tarif).toBeEnabled();
  await tarif.click();
  await page.getByRole('option', { name: 'Rumah Tangga', exact: true }).click();
  // Pasang baru has one "Permohonan daya"; Perubahan daya has "Daya lama" then "Daya baru".
  const pick = async (name: string, option: RegExp) => {
    const combo = page.getByRole('combobox', { name, exact: true });
    await expect(combo).toBeEnabled();
    await combo.click();
    await page.getByRole('option', { name: option }).first().click();
  };
  if (await page.getByRole('combobox', { name: 'Daya lama', exact: true }).count()) {
    await pick('Daya lama', /900 VA/);
    await pick('Daya baru', /2\.200 VA/);
  } else {
    await pick('Permohonan daya', /900 VA/);
  }
  await page.locator('input[type=file]').setInputFiles(EVIDENCE);
  const created = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/permohonan' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Simpan permohonan' }).click();
  await confirmDialog(page);
  const res = await created;
  expect(res.status(), 'create permohonan').toBe(201);
  return (await res.json()).data as { id: string; no_permohonan: string };
}

/** Fill and submit the form of one activity; returns the activity POST status. */
async function completeActivity(page: Page, id: string, action: Action, decisions: Decisions) {
  await page.goto(`/permohonan/${id}`);
  await expect(page.getByRole('heading', { level: 2, name: 'Riwayat aktivitas' })).toBeVisible();

  // Survei opens its own page (a link); every other activity opens inline (a button).
  const proceed = page.getByRole('link', { name: 'Lanjutkan proses' }).or(page.getByRole('button', { name: 'Lanjutkan proses' }));
  await proceed.click();
  const submitName = { name: 'Simpan dan selesaikan aktivitas' };
  await expect(page.getByRole('button', submitName)).toBeVisible();
  // Inline forms live in their own region on the detail page, which has other
  // sections too; the survei page has only the form.
  const region = page.getByRole('region').filter({ has: page.getByRole('button', submitName) });
  const form = await region.count() ? region : page.locator('main');
  const submit = form.getByRole('button', submitName);

  const date = form.getByRole('textbox', { name: /^(Tanggal|Estimasi tanggal)/ });
  if (await date.count()) {
    const [y, m, d] = new Date().toISOString().slice(0, 10).split('-');
    await date.click();
    await date.pressSequentially(`${d}/${m}/${y}`);
  }
  // Pemasangan Tiang asks for the pole location (map click or manual coordinates).
  const lat = form.getByRole('textbox', { name: 'Latitude' });
  // The map loads lazily, so wait briefly for the field instead of counting it right away.
  if (await lat.waitFor({ timeout: 3_000 }).then(() => true, () => false)) {
    const lng = form.getByRole('textbox', { name: 'Longitude' });
    await lat.fill('-7.2575');
    await lng.fill('112.7521');
    await expect(lat).toHaveValue('-7.2575');
    await expect(lng).toHaveValue('112.7521');
  }
  const result = form.getByRole('textbox', { name: 'Hasil pengoperasian jaringan' });
  if (await result.count()) await result.fill('E2E: jaringan beroperasi normal');
  await form.getByRole('textbox', { name: /Catatan/ }).fill(`E2E ${action.workflow_node}`);

  // A role with several open activities also gets an "Aktivitas yang dapat
  // Anda kerjakan" combobox; it is left on its default (the first activity).
  for (const [label, answer] of Object.entries(decisions)) {
    const combo = form.getByRole('combobox', { name: label, exact: true });
    if (!(await combo.count())) continue;
    await combo.click();
    await page.getByRole('option', { name: answer, exact: true }).click();
    await expect(combo).toHaveText(answer);
  }
  // Each vendor combobox lists one vendor account; take it.
  for (const combo of await form.getByRole('combobox', { name: /^Vendor / }).all()) {
    await combo.click();
    await page.getByRole('option').first().click();
  }

  await form.locator('input[type=file]').setInputFiles(EVIDENCE);
  await expect(form.getByText('1 berkas dipilih')).toBeVisible();

  // The node that will be submitted is whatever the form shows, which may not
  // be action[0] when the role has several; wait for any activity POST.
  const submitted = page.waitForResponse((r) => r.request().method() === 'POST'
    && new RegExp(`/api/permohonan/${id}/(?!vendor-assignments)`).test(r.url()));
  const uploaded = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/documents$/.test(r.url()));
  await submit.click();
  await confirmDialog(page);
  expect((await uploaded).status(), 'evidence upload').toBe(201);
  const res = await submitted;
  return { status: res.status(), path: new URL(res.url()).pathname };
}

type Flow = {
  name: string; creator: string; decisions: Decisions;
  /** Create-form choices; the defaults are Pasang baru / JTR (pelayanan) or PLG TM <5 GWNG / ULP Taman (NPS). */
  create?: CreateChoices;
  /** Final permohonan status: "Dikembalikan" at Delegasi PK NPS ends the workflow as returned. */
  status: 'completed' | 'returned';
  /** Workflow nodes the decisions should skip. */
  skipped: string[];
  /** Roles that must act at some point, e.g. the ULP's own teknik and pelayanan. */
  actors?: string[];
};

const flows: Flow[] = [
  {
    name: 'JTR via ULP Taman, with tiang and PDKB',
    creator: 'pelayanan-taman',
    decisions: { 'Kebutuhan tiang': 'Ya', 'Delegasi PK NPS': 'Didelegasikan', 'Perlu PDKB': 'Ya' },
    status: 'completed',
    skipped: [],
    actors: ['teknik-taman', 'pelayanan-taman'],
  },
  {
    name: 'JTR via ULP Taman, without tiang and PDKB',
    creator: 'pelayanan-taman',
    decisions: { 'Kebutuhan tiang': 'Tidak', 'Delegasi PK NPS': 'Didelegasikan', 'Perlu PDKB': 'Tidak' },
    status: 'completed',
    skipped: ['wo_tiang', 'wo_pdkb', 'pemasangan_tiang', 'pdkb_documentation'],
  },
  {
    name: 'JTR Perubahan daya via ULP Karang Pilang',
    creator: 'pelayanan-pilang',
    create: { 'Jenis permohonan': 'Perubahan daya' },
    decisions: { 'Kebutuhan tiang': 'Tidak', 'Delegasi PK NPS': 'Didelegasikan', 'Perlu PDKB': 'Ya' },
    status: 'completed',
    skipped: ['wo_tiang', 'pemasangan_tiang'],
    actors: ['teknik-pilang', 'pelayanan-pilang'],
  },
  {
    name: 'NPS PLG TM <5 GWNG for ULP Menganti',
    creator: 'nps-up',
    create: { 'Jenis sambungan': 'PLG TM <5 GWNG', 'Unit / ULP': 'ULP Menganti' },
    decisions: { 'Kebutuhan tiang': 'Ya', 'Delegasi PK NPS': 'Didelegasikan', 'Perlu PDKB': 'Tidak' },
    status: 'completed',
    skipped: ['wo_pdkb', 'pdkb_documentation'],
  },
  {
    name: 'NPS PLG TM >5 GWNG for ULP Karang Pilang',
    creator: 'nps-up',
    create: { 'Jenis sambungan': 'PLG TM >5 GWNG', 'Unit / ULP': 'ULP Karang Pilang' },
    decisions: { 'Kebutuhan tiang': 'Ya', 'Delegasi PK NPS': 'Didelegasikan', 'Perlu PDKB': 'Ya' },
    status: 'completed',
    skipped: [],
  },
  {
    name: 'NPS returns the permohonan at Delegasi PK NPS',
    creator: 'nps-up',
    create: { 'Unit / ULP': 'ULP Menganti' },
    decisions: { 'Kebutuhan tiang': 'Tidak', 'Delegasi PK NPS': 'Dikembalikan' },
    status: 'returned',
    skipped: ['wo_tiang', 'pemasangan_tiang'],
  },
];

test.describe('@workflow @e2e-write full PB/PD workflow', () => {
  test.skip(!isSafeEnv(), 'writes real data: set E2E_SAFE_ENV=true (development server only)');
  test.setTimeout(10 * 60_000);

  for (const flow of flows) {
    test(flow.name, async ({ browser, baseURL, request }, testInfo) => {
      const api = new Api(request);
      const sessions = new Sessions(browser, baseURL!, api);
      testInfo.annotations.push({ type: 'workaround', description: 'BUG-WF-001: vendor list replayed with a super-user token' });
      try {
        const customer = `E2E Flow ${new Date().toISOString().slice(0, 16)} ${testInfo.workerIndex}`;
        const created = await test.step(`${flow.creator}: buat permohonan`, async () =>
          createPermohonan(await sessions.page(flow.creator), customer, flow.create ?? {}));
        testInfo.annotations.push({ type: 'permohonan', description: `${created.no_permohonan} (${created.id})` });

        const done: string[] = [];
        for (let step = 0; step < 25; step++) {
          const p = await api.permohonan(created.id);
          if (p.status !== 'in_progress') break;
          const next = await api.nextActor(created.id);
          expect(next, `someone can act at stage ${p.current_stage}`).toBeTruthy();
          const { role, actions } = next!;
          const result = await test.step(`${role}: ${actions.map((a) => a.workflow_node).join(' / ')}`, async () =>
            completeActivity(await sessions.page(role), created.id, actions[0], flow.decisions));
          expect(result.status, `${role} ${result.path}`).toBe(200);
          done.push(`${role} ${result.path.split('/').pop()}`);
        }
        await testInfo.attach('activities.txt', { body: done.join('\n'), contentType: 'text/plain' });

        const final = await api.permohonan(created.id);
        expect(final.status).toBe(flow.status);
        if (flow.status === 'completed') {
          expect(final.workflow_nodes.filter((n) => !['completed', 'skipped'].includes(n.status)).map((n) => n.workflow_node)).toEqual([]);
        } else {
          expect(await api.nextActor(created.id), 'nobody can act on a returned permohonan').toBeUndefined();
        }
        const decided = (label: string) => (label in flow.decisions ? flow.decisions[label] === 'Ya' : null);
        expect(final.kebutuhan_tiang, 'kebutuhan tiang decision').toBe(decided('Kebutuhan tiang'));
        expect(final.perlu_pdkb, 'perlu PDKB decision').toBe(decided('Perlu PDKB'));
        expect(final.workflow_nodes.filter((n) => n.status === 'skipped').map((n) => n.workflow_node).sort())
          .toEqual([...flow.skipped].sort());
        const actors = new Set(done.map((d) => d.split(' ')[0]));
        for (const role of flow.actors ?? []) expect(actors, `${role} acted`).toContain(role);
        const docs = await api.documents(created.id);
        // +1: the create form now requires an evidence file of its own.
        expect(docs.length, 'one evidence per completed activity plus the creation evidence').toBe(done.length + 1);
        expect(docs.every((d) => d.original_filename === 'e2e-evidence.pdf')).toBeTruthy();

        // The detail page reflects the end state for the creator.
        const page = await sessions.page(flow.creator);
        await page.goto(`/permohonan/${created.id}`);
        await expect(page.getByRole('heading', { level: 1, name: customer })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Lanjutkan proses' })).toHaveCount(0);
      } finally {
        await sessions.close();
      }
    });
  }
});
