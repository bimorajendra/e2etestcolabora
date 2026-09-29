import { expect, type Page, type TestInfo } from '@playwright/test';

export type ConsoleEntry = { type: string; text: string; url: string };
export type NetworkIssue = {
  url: string;
  method: string;
  status?: number;
  error?: string;
  resourceType: string;
  classification: 'BUG_CANDIDATE' | 'EXPECTED' | 'BLOCKED_BY_GUARD' | 'THIRD_PARTY' | 'NOISE';
};

/**
 * Records console output, uncaught exceptions, failed requests and HTTP >= 400
 * for one page, and classifies each network issue. Only BUG_CANDIDATE issues
 * and uncaught exceptions fail a test (via assertHealthy); console warnings and
 * errors are attached to the report for review, not asserted.
 */
export class PageMonitor {
  readonly console: ConsoleEntry[] = [];
  readonly pageErrors: string[] = [];
  readonly network: NetworkIssue[] = [];
  private expected: RegExp[] = [/favicon\.ico$/i];

  constructor(page: Page, private firstParty: string[], private guardBlocked: Set<string>) {
    page.on('console', (m) => this.console.push({ type: m.type(), text: m.text(), url: page.url() }));
    page.on('pageerror', (e) => this.pageErrors.push(`${e.name}: ${e.message}`));
    page.on('requestfailed', (r) => {
      const error = r.failure()?.errorText ?? 'unknown';
      const key = `${r.method()} ${r.url()}`;
      // Aborted requests are navigation/prefetch cancellation noise, not failures.
      const classification = this.guardBlocked.has(key) ? 'BLOCKED_BY_GUARD'
        : /ERR_ABORTED|NS_BINDING_ABORTED/.test(error) ? 'NOISE'
        : this.classify(r.url());
      this.network.push({ url: r.url(), method: r.method(), error, resourceType: r.resourceType(), classification });
    });
    page.on('response', (r) => {
      if (r.status() < 400) return;
      const req = r.request();
      this.network.push({
        url: r.url(), method: req.method(), status: r.status(), resourceType: req.resourceType(),
        classification: this.classify(r.url()),
      });
    });
  }

  /** Declare responses matching `pattern` as expected for this test (e.g. 401 on bad login). */
  expect(pattern: RegExp) {
    this.expected.push(pattern);
  }

  private classify(url: string): NetworkIssue['classification'] {
    if (this.expected.some((p) => p.test(url))) return 'EXPECTED';
    let origin: string;
    try { origin = new URL(url).origin; } catch { return 'NOISE'; }
    return this.firstParty.includes(origin) ? 'BUG_CANDIDATE' : 'THIRD_PARTY';
  }

  consoleErrors() {
    return this.console.filter((c) => c.type === 'error');
  }

  bugCandidates() {
    return this.network.filter((n) => n.classification === 'BUG_CANDIDATE');
  }

  async attach(testInfo: TestInfo) {
    const byType = this.console.reduce<Record<string, number>>((acc, c) => {
      acc[c.type] = (acc[c.type] ?? 0) + 1;
      return acc;
    }, {});
    const summary = {
      consoleByType: byType,
      consoleErrors: this.consoleErrors(),
      consoleWarnings: this.console.filter((c) => c.type === 'warning'),
      pageErrors: this.pageErrors,
      network: this.network,
    };
    await testInfo.attach('page-monitor.json', { body: JSON.stringify(summary, null, 2), contentType: 'application/json' });
    if (this.consoleErrors().length || this.pageErrors.length || this.bugCandidates().length) {
      testInfo.annotations.push({
        type: 'monitor',
        description: `console.error=${this.consoleErrors().length} pageerror=${this.pageErrors.length} http/network bug-candidates=${this.bugCandidates().length}`,
      });
    }
  }

  /** No uncaught JS exceptions and no unexpected first-party failed requests / HTTP >= 400. */
  assertHealthy() {
    expect.soft(this.pageErrors, 'uncaught JavaScript exceptions').toEqual([]);
    expect.soft(
      this.bugCandidates().map((n) => `${n.method} ${n.url} -> ${n.status ?? n.error}`),
      'first-party failed requests / HTTP >= 400',
    ).toEqual([]);
  }
}
