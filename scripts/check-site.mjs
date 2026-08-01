import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const [source, html, css, app, configSource] = await Promise.all([
  readFile(path.join(ROOT, 'README.md'), 'utf8'),
  readFile(path.join(DIST, 'index.html'), 'utf8'),
  readFile(path.join(DIST, 'styles.css'), 'utf8'),
  readFile(path.join(DIST, 'app.js'), 'utf8'),
  readFile(path.join(ROOT, 'site', 'config.json'), 'utf8'),
  access(path.join(DIST, '.nojekyll')),
]);

function stripMarkdown(value = '') {
  return String(value)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getReadmeLeadImages(markdown) {
  const images = [];
  let titleSeen = false;

  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const heading = line.match(/^#\s+(.+?)\s*$/);
    if (heading) {
      if (!titleSeen) {
        titleSeen = true;
        continue;
      }
      break;
    }

    if (!titleSeen) continue;
    const image = line.trim().match(/^!\[([^\]]*)\]\((https?:\/\/[^)]+)\)\s*$/);
    if (image) images.push({ alt: image[1], url: image[2] });
  }

  return images;
}

function getReadmeContentLinks(markdown) {
  const links = [];
  let titleSkipped = false;

  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    if (!titleSkipped && /^#\s+/.test(line)) {
      titleSkipped = true;
      continue;
    }

    for (const match of line.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)) {
      if (match.index > 0 && line[match.index - 1] === '!') continue;
      links.push({ label: stripMarkdown(match[1]), url: match[2] });
    }
  }

  return links;
}

function normalizeText(value) {
  return String(value)
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s*\/\s*/g, '/')
    .trim();
}

function getReadmeTextLines(markdown) {
  const textLines = [];
  let titleSkipped = false;

  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    if (!titleSkipped && /^#\s+/.test(line)) {
      titleSkipped = true;
      continue;
    }

    if (!line.trim() || /^!\[/.test(line.trim())) continue;
    const text = normalizeText(stripMarkdown(line.replace(/^#{1,6}\s+/, '').replace(/^\s*-\s+/, '')));
    if (text) textLines.push(text);
  }

  return textLines;
}

function htmlToPlainText(value) {
  const decoded = value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");

  return normalizeText(decoded);
}

function slugify(value = '') {
  return stripMarkdown(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

function getReadmeStructure(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  let currentSection = null;
  let titleSeen = false;

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (!heading) continue;

    const level = heading[1].length;
    const title = stripMarkdown(heading[2]);

    if (level === 1) {
      if (!titleSeen) {
        titleSeen = true;
        continue;
      }
      currentSection = { title, id: slugify(title), headings: [] };
      sections.push(currentSection);
      continue;
    }

    if (currentSection && level >= 2) {
      currentSection.headings.push({
        title,
        id: `${currentSection.id}-${slugify(title)}`,
      });
    }
  }

  return sections;
}

function countSearchableResources(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let currentSection = '';
  let count = 0;
  let listIndents = [];

  const resetList = () => {
    listIndents = [];
  };

  for (const line of lines) {
    const heading = line.match(/^#\s+(.+?)\s*$/);
    if (heading) {
      currentSection = stripMarkdown(heading[1]);
      resetList();
      continue;
    }

    const listItem = line.match(/^(\s*)-\s+(.+)$/);
    if (!listItem) {
      resetList();
      continue;
    }

    const indent = listItem[1].replace(/\t/g, '    ').length;
    while (listIndents.length && indent <= listIndents.at(-1)) listIndents.pop();
    const isRoot = listIndents.length === 0;
    listIndents.push(indent);

    if (isRoot && currentSection && currentSection.toLowerCase() !== 'introduction') count += 1;
  }

  return count;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let siteConfig;
try {
  siteConfig = JSON.parse(configSource);
} catch (error) {
  throw new Error(`site/config.json is invalid JSON: ${error.message}`);
}
assert(
  typeof siteConfig.renderLeadImage === 'boolean',
  'site/config.json must define renderLeadImage as true or false.',
);

assert(!html.includes('{{'), 'Generated site contains unresolved template placeholders.');
assert((html.match(/<h1(?:\s|>)/g) || []).length === 1, 'Generated site must contain exactly one h1.');
assert(html.includes('class="sidebar"'), 'Generated site is missing the desktop sidebar.');
assert(html.includes('class="mobile-header"'), 'Generated site is missing the mobile header.');
assert(html.includes('class="sidebar-scrim"'), 'Generated site is missing the mobile sidebar scrim.');
assert(html.includes('id="search"'), 'Generated site is missing the resource search input.');
assert(html.includes('id="noResults"'), 'Generated site is missing the no-results state.');
assert(!html.includes('class="document-meta"'), 'Generated site still contains the removed document metadata.');
assert(!html.includes('Generated from README.md'), 'Generated site still contains the removed README generation label.');
assert(!html.includes('Content source:'), 'Generated site still contains the removed footer source label.');

const sections = getReadmeStructure(source);
assert(sections.length > 0, 'README structure check found no sections.');

for (const section of sections) {
  assert(html.includes(`id="${section.id}"`), `Generated site is missing section #${section.id}.`);
  assert(html.includes(`href="#${section.id}"`), `Sidebar is missing a link to #${section.id}.`);

  for (const heading of section.headings) {
    assert(html.includes(`id="${heading.id}"`), `Generated site is missing heading #${heading.id}.`);
  }
}

const leadImages = getReadmeLeadImages(source);
const renderedLeadImages = (html.match(/class="lead-image"/g) || []).length;
if (siteConfig.renderLeadImage) {
  assert(leadImages.length > 0, 'renderLeadImage is enabled, but README.md has no lead image.');
  assert(
    renderedLeadImages === leadImages.length,
    `Lead image mismatch: README has ${leadImages.length}, generated HTML has ${renderedLeadImages}.`,
  );
  for (const image of leadImages) {
    const secureUrl = image.url.startsWith('http://') ? `https://${image.url.slice(7)}` : image.url;
    assert(html.includes(`src="${escapeHtml(secureUrl)}"`), `Generated site is missing README lead image: ${image.alt || image.url}.`);
  }
} else {
  assert(renderedLeadImages === 0, 'Lead image rendered even though renderLeadImage is false.');
}

const readmeLinks = getReadmeContentLinks(source);
assert(readmeLinks.length > 0, 'README link check found no content links.');
for (const link of readmeLinks) {
  assert(
    html.includes(`href="${escapeHtml(link.url)}"`),
    `Generated site is missing README link: ${link.label || link.url}.`,
  );
}

const readmeTextLines = getReadmeTextLines(source);
const generatedText = htmlToPlainText(html);
for (const text of readmeTextLines) {
  assert(generatedText.includes(text), `Generated site is missing README text: ${text.slice(0, 80)}.`);
}

const expectedResources = countSearchableResources(source);
const renderedResources = (html.match(/data-resource="true"/g) || []).length;
assert(expectedResources > 0, 'README resource count is zero.');
assert(
  renderedResources === expectedResources,
  `Resource count mismatch: README has ${expectedResources}, generated HTML has ${renderedResources}.`,
);

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
assert(duplicateIds.length === 0, `Generated site contains duplicate IDs: ${[...new Set(duplicateIds)].join(', ')}`);

for (const requiredCss of ['--sidebar-width', '.sidebar', '.toc-link', '.document-section', '.search-field']) {
  assert(css.includes(requiredCss), `Generated stylesheet is missing ${requiredCss}.`);
}

for (const legacyToken of ['.hero-panel', '.ticker-track', 'data-kb-selected', '--orange:', '--lime:']) {
  assert(!css.includes(legacyToken), `Legacy promotional styling remains in CSS: ${legacyToken}`);
}

for (const requiredAppToken of [
  '[data-resource="true"]',
  'filterResources',
  'sidebar-open',
  'data-section-link',
  "toggleAttribute('inert'",
  'Close navigation',
  'atPageEnd',
  'visibleSections.at(-1)',
]) {
  assert(app.includes(requiredAppToken), `Browser script is missing expected behavior: ${requiredAppToken}`);
}

for (const legacyAppToken of ['data-kb-weight-label', 'IntersectionObserver', 'selectedBellWeight']) {
  assert(!app.includes(legacyAppToken), `Legacy browser behavior remains in app.js: ${legacyAppToken}`);
}

console.log(`Validation passed: ${sections.length} README sections, ${renderedResources} searchable resources, ${readmeLinks.length} README content links, and ${readmeTextLines.length} README text lines.`);
