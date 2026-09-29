// Prints each failed test with the first lines of its final error, from artifacts/results.json.
import fs from 'node:fs';
const r = JSON.parse(fs.readFileSync('artifacts/results.json', 'utf8'));
const out = [];
const walk = (s) => {
  (s.specs || []).forEach((sp) => sp.tests.forEach((t) => {
    const last = t.results[t.results.length - 1];
    if (t.status === 'unexpected') {
      const e = (last.error?.message || '').replace(/\x1b\[[0-9;]*m/g, '').split('\n').filter(Boolean).slice(0, 3).join(' | ');
      out.push(`${sp.file.split('/').pop()} :: ${sp.title}\n    ${e.slice(0, 330)}`);
    }
  }));
  (s.suites || []).forEach(walk);
};
r.suites.forEach(walk);
console.log(out.join('\n'));
