import fs from 'node:fs';
import path from 'node:path';

export type Account = { role: string; label: string; email: string; password: string; disabled?: string };

// Test accounts live in accounts.local.json (gitignored). Copy
// accounts.example.json to create it. Never put passwords in spec files.
const FILE = path.resolve(__dirname, '../../accounts.local.json');

function readAll(): Account[] {
  if (!fs.existsSync(FILE)) return [];
  return JSON.parse(fs.readFileSync(FILE, 'utf8')) as Account[];
}

/** Accounts usable for login (not disabled), optionally narrowed by E2E_ROLES. */
export function loadAccounts(): Account[] {
  const only = process.env.E2E_ROLES?.split(',').map((r) => r.trim()).filter(Boolean);
  return readAll().filter((a) => a.email && a.password && !a.disabled && (!only?.length || only.includes(a.role)));
}

/** Accounts marked `disabled` (e.g. credential not present in this environment). */
export function disabledAccounts(): Account[] {
  return readAll().filter((a) => a.disabled);
}

export function getAccount(role: string): Account | undefined {
  return readAll().find((a) => a.role === role && !a.disabled);
}
