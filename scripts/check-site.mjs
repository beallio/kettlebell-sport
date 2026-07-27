import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [html, css, app] = await Promise.all([
  readFile(path.join(root, 'dist', 'index.html'), 'utf8'),
  readFile(path.join(root, 'dist', 'styles.css'), 'utf8'),
  readFile(path.join(root, 'dist', 'app.js'), 'utf8'),
]);
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

const bellWeights = ['16', '20', '24', '28', '32'];
const missingBellColors = bellWeights.filter((weight) => !css.includes(`data-kb-selected="${weight}"`));
if (missingBellColors.length) throw new Error(`Missing competition-bell color styles: ${missingBellColors.join(', ')}`);
if (!html.includes('const weights = [16,20,24,28,32]')) throw new Error('Generated site is missing the random competition-bell weight list.');
if (!html.includes("URLSearchParams(globalThis.location.search).get('bell')")) throw new Error('Generated site is missing the optional ?bell= weight override.');
if (!app.includes("document.querySelectorAll('[data-kb-weight-label]')")) throw new Error('Bell labels are not synchronized in app.js.');
if (app.includes("querySelectorAll('[data-kb-weight]')")) throw new Error('Bell selector root collision regression detected.');

const resources = (html.match(/data-resource="true"/g) || []).length;
if (resources < 1) throw new Error('Generated site contains no searchable resources.');
console.log(`Validation passed: ${resources} searchable resources found.`);
