import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const internal = await readFile('lib/tours/providers.ts', 'utf8');
const forbidden = [
  'reviewRank', '評價樣本順序', '依評價樣本分組',
  ...[...internal.matchAll(/review\("([^"]+)","([^"]+)"/g)].flatMap(match => [match[1], match[2]]),
  ...[...internal.matchAll(/(?:summary|label):"([^"]+)"/g)].map(match => match[1]),
];
let checked = 0;
async function inspect(file) {
  const text = await readFile(file, 'utf8');
  for (const value of forbidden) assert(!text.includes(value), `Private research leaked into ${file}`);
  checked++;
}
async function walk(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) await walk(file);
    else if (/\.(?:js|mjs|json|html|map)$/.test(file)) await inspect(file);
  }
}
await walk('dist');
if (process.argv[2]) await inspect(process.argv[2]);
console.log(`PASS: ${checked} public assets contain no internal review text, sources or ranking labels.`);
