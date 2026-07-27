import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(path.join(root, 'dist', 'index.html'), 'utf8');
const required = ['id="lifts"', 'id="directory"', 'id="equipment"', 'id="education"', 'id="programming"'];
const missing = required.filter((token) => !html.includes(token));
if (missing.length) throw new Error(`Generated site is missing expected content: ${missing.join(', ')}`);
if (html.includes('{{')) throw new Error('Generated site contains unresolved template placeholders.');
const hierarchyRequired = [
  'id="equipment-accessories"',
  'id="equipment-belts"',
  'id="equipment-miscellaneous"',
];
const hierarchyMissing = hierarchyRequired.filter((token) => !html.includes(token));
if (hierarchyMissing.length) throw new Error(`Generated site lost expected equipment hierarchy: ${hierarchyMissing.join(', ')}`);

const resources = (html.match(/data-resource="true"/g) || []).length;
if (resources < 1) throw new Error('Generated site contains no searchable resources.');
console.log(`Validation passed: ${resources} searchable resources found.`);
