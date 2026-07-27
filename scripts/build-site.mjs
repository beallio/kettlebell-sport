import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const README_PATH = path.join(ROOT, 'README.md');
const TEMPLATE_PATH = path.join(ROOT, 'site', 'template.html');
const DIST = path.join(ROOT, 'dist');

// Featured competition bell. Supported display colors: 24 kg = green, 28 kg = orange.
const FEATURED_WEIGHT = 24;
const FEATURED_WEIGHT_CLASS = FEATURED_WEIGHT === 28 ? '28' : '24';

const SECTION_META = {
  Equipment: { kicker: 'GEAR', description: 'Competition bells, youth equipment, belts, prep tools, chalk, shoes and storage.' },
  Education: { kicker: 'LEARN', description: 'Technique instruction, follow-along sessions, interviews, GPP and practical setup advice.' },
  Programming: { kicker: 'TRAIN', description: 'Free programs and programming guidance for long cycle, jerk and general sport preparation.' },
  Competitions: { kicker: 'COMPETE', description: 'Calendars and organizations for finding events and competition opportunities.' },
  Coaching: { kicker: 'COACH', description: 'Directories and resources for finding kettlebell sport coaching.' },
  'Ranking Tables': { kicker: 'RANK', description: 'Ranking standards from major kettlebell sport organizations around the world.' },
};

const NAV_LABELS = {
  Equipment: 'Gear', Education: 'Learn', Programming: 'Train', Competitions: 'Compete', Coaching: 'Coach', 'Ranking Tables': 'Ranks',
};

function escapeHtml(value = '') {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stripMarkdown(value) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function renderInline(markdown, { classifyLinks = false } = {}) {
  const tokens = [];
  let tokenIndex = 0;
  let linkIndex = 0;

  const stash = (html) => {
    const key = `@@TOKEN_${tokenIndex++}@@`;
    tokens.push([key, html]);
    return key;
  };

  let value = markdown;
  value = value.replace(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g, (_, alt, url) => stash(`<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy">`));
  value = value.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_, label, url) => {
    const cls = classifyLinks ? (linkIndex++ === 0 ? 'primary-link' : 'utility-link') : '';
    return stash(`<a${cls ? ` class="${cls}"` : ''} href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`);
  });
  value = escapeHtml(value);
  value = value.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  value = value.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  value = value.replace(/`([^`]+)`/g, '<code>$1</code>');
  for (const [key, html] of tokens) value = value.replace(key, html);
  return value;
}

function parseMarkdown(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ type: 'paragraph', text: paragraph.join(' ').trim() });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    const listItem = line.match(/^(\s*)-\s+(.+)$/);

    if (heading) {
      flushParagraph();
      blocks.push({ type: 'heading', level: heading[1].length, text: stripMarkdown(heading[2]), raw: heading[2] });
      continue;
    }

    if (listItem) {
      flushParagraph();
      const indent = listItem[1].replace(/\t/g, '    ').length;
      blocks.push({ type: 'listItem', indent, text: listItem[2].trim() });
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    // Ignore standalone images in the site build; the README still retains them.
    if (/^!\[[^\]]*\]\([^)]+\)\s*$/.test(line.trim())) {
      flushParagraph();
      blocks.push({ type: 'image', raw: line.trim() });
      continue;
    }

    paragraph.push(line.trim());
  }
  flushParagraph();
  return blocks;
}

function getHeadingRange(blocks, title, level) {
  const start = blocks.findIndex((block) => block.type === 'heading' && block.level === level && block.text.toLowerCase() === title.toLowerCase());
  if (start < 0) return [];
  let end = blocks.length;
  for (let i = start + 1; i < blocks.length; i += 1) {
    if (blocks[i].type === 'heading' && blocks[i].level <= level) { end = i; break; }
  }
  return blocks.slice(start + 1, end);
}

function getSubheadingRange(blocks, title, level) {
  return getHeadingRange(blocks, title, level);
}

function extractIntro(blocks) {
  const introBlocks = getHeadingRange(blocks, 'Introduction', 1);
  const whatBlocks = getSubheadingRange(introBlocks, 'What is Kettlebell Sport?', 2);
  const paragraph = whatBlocks.find((block) => block.type === 'paragraph')?.text || 'Endurance kettlebell lifting built around efficiency, pacing and repeatable technique.';
  const liftBlocks = getSubheadingRange(whatBlocks, 'Lifts', 3);
  const linkBlocks = getSubheadingRange(whatBlocks, 'Links', 3);
  const lifts = liftBlocks.filter((block) => block.type === 'listItem' && block.indent <= 1).map((block) => {
    const match = block.text.match(/^\*\*(.+?)\*\*\s*-?\s*(.*)$/);
    return { name: stripMarkdown(match?.[1] || block.text), description: match?.[2] || '' };
  });
  return { paragraph, lifts, linkItems: buildListTree(linkBlocks.filter((block) => block.type === 'listItem')) };
}

function buildListTree(listBlocks) {
  const roots = [];
  const stack = [];
  for (const block of listBlocks) {
    const node = { text: block.text, indent: block.indent, children: [] };
    while (stack.length && block.indent <= stack.at(-1).indent) stack.pop();
    if (stack.length) stack.at(-1).node.children.push(node);
    else roots.push(node);
    stack.push({ indent: block.indent, node });
  }
  return roots;
}

function liftCode(name, description) {
  const source = `${name} ${description}`;
  if (/long cycle/i.test(source)) return 'LC / TALC / OALC';
  if (/double half/i.test(source)) return 'DHS / HS';
  if (/snatch/i.test(name)) return 'SNATCH';
  if (/jerk/i.test(name)) return 'JERK / OAJ';
  return name.toUpperCase().slice(0, 18);
}

function renderLiftCards(lifts) {
  return lifts.map((lift, index) => `<article class="lift-card reveal">
    <div class="lift-num">${String(index + 1).padStart(2, '0')}</div>
    <div class="lift-body"><p class="lift-code">${escapeHtml(liftCode(lift.name, lift.description))}</p><h3>${escapeHtml(lift.name)}</h3><p>${renderInline(lift.description)}</p></div>
    <div class="lift-meter" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
  </article>`).join('');
}

function renderPlainList(nodes) {
  if (!nodes.length) return '<ul></ul>';
  const renderNode = (node) => `<li>${renderInline(node.text)}${node.children.length ? `<ul>${node.children.map(renderNode).join('')}</ul>` : ''}</li>`;
  return `<ul>${nodes.map(renderNode).join('')}</ul>`;
}

function renderResourceList(nodes, topLevel = true) {
  if (!nodes.length) return '';
  const renderNode = (node, isTop) => {
    const search = escapeHtml(stripMarkdown(node.text + ' ' + node.children.map((child) => child.text).join(' ')).toLowerCase());
    return `<li class="resource-item${node.children.length ? ' has-note' : ''}"${isTop ? ` data-resource="true" data-search="${search}"` : ''}>${renderInline(node.text, { classifyLinks: true })}${node.children.length ? `<ul>${node.children.map((child) => renderNode(child, false)).join('')}</ul>` : ''}</li>`;
  };
  return `<ul>${nodes.map((node) => renderNode(node, topLevel)).join('')}</ul>`;
}

function parseDirectory(blocks) {
  const firstLevel = blocks.filter((block) => block.type === 'heading' && block.level === 1).map((block) => block.text);
  const excluded = new Set(['Kettlebell Sport', 'Introduction']);
  const titles = firstLevel.filter((title) => !excluded.has(title));

  return titles.map((title) => {
    const sectionBlocks = getHeadingRange(blocks, title, 1);
    const groups = [];
    let current = { heading: null, level: null, list: [], paragraphs: [] };
    const flush = () => {
      if (current.heading || current.list.length || current.paragraphs.length) groups.push(current);
      current = { heading: null, level: null, list: [], paragraphs: [] };
    };

    for (const block of sectionBlocks) {
      if (block.type === 'heading' && block.level >= 2) {
        flush();
        current.heading = block.text;
        current.level = block.level;
      } else if (block.type === 'listItem') {
        current.list.push(block);
      } else if (block.type === 'paragraph') {
        current.paragraphs.push(block.text);
      }
    }
    flush();
    return { title, groups };
  });
}

function renderDirectory(sections) {
  return sections.map((section, index) => {
    const meta = SECTION_META[section.title] || { kicker: 'EXPLORE', description: `Resources collected under ${section.title}.` };
    const sectionId = slugify(section.title);
    const content = section.groups.map((group) => {
      const headingTag = group.level === 3 ? 'h3' : 'h2';
      const headingClass = group.level === 3 ? 'resource-subcategory' : 'resource-category';
      const heading = group.heading ? `<${headingTag} class="${headingClass}" id="${sectionId}-${slugify(group.heading)}">${escapeHtml(group.heading)}</${headingTag}>` : '';
      const paragraphs = group.paragraphs.map((paragraph) => `<p>${renderInline(paragraph)}</p>`).join('');
      const list = renderResourceList(buildListTree(group.list));
      return `${heading}${paragraphs}${list}`;
    }).join('\n');

    return `<section class="resource-section reveal" id="${sectionId}">
      <div class="resource-heading">
        <div class="section-index">${String(index + 1).padStart(2, '0')}</div>
        <div><p class="section-kicker">${escapeHtml(meta.kicker)}</p><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(meta.description)}</p></div>
      </div>
      <div class="resource-content">${content}</div>
    </section>`;
  }).join('\n');
}

function countLinks(source) {
  return [...source.matchAll(/\[[^\]]+\]\((https?:\/\/[^)]+)\)/g)].length;
}

function countResources(sections) {
  return sections.reduce((total, section) => total + section.groups.reduce((sum, group) => {
    const tree = buildListTree(group.list);
    return sum + tree.length;
  }, 0), 0);
}

function ticker(lifts) {
  const names = [...lifts.map((lift) => lift.name), 'Technique over tension'];
  return [...names, ...names].map((name) => `<span>${escapeHtml(name)}</span>`).join('');
}

async function build() {
  const [source, template] = await Promise.all([
    readFile(README_PATH, 'utf8'),
    readFile(TEMPLATE_PATH, 'utf8'),
  ]);
  const blocks = parseMarkdown(source);
  const intro = extractIntro(blocks);
  const sections = parseDirectory(blocks);
  const linkCount = countLinks(source);
  const resourceCount = countResources(sections);

  if (!intro.lifts.length) throw new Error('Build failed: could not find Introduction → What is Kettlebell Sport? → Lifts in README.md');
  if (!sections.length) throw new Error('Build failed: no top-level resource sections found in README.md');

  const replacements = {
    NAV_LINKS: `<a href="#lifts">Lifts</a>${sections.map((section) => `<a href="#${slugify(section.title)}">${escapeHtml(NAV_LABELS[section.title] || section.title)}</a>`).join('')}`,
    INTRO_TEXT: renderInline(intro.paragraph),
    LINK_COUNT: String(linkCount),
    RESOURCE_COUNT: String(resourceCount),
    LIFT_COUNT: String(intro.lifts.length),
    TICKER: ticker(intro.lifts),
    LIFT_CARDS: renderLiftCards(intro.lifts),
    INTRO_LINKS: renderPlainList(intro.linkItems),
    DIRECTORY: renderDirectory(sections),
    FEATURED_WEIGHT: String(FEATURED_WEIGHT),
    FEATURED_WEIGHT_CLASS,
  };

  let output = template;
  for (const [key, value] of Object.entries(replacements)) output = output.replaceAll(`{{${key}}}`, value);
  const unresolved = [...output.matchAll(/{{[A-Z0-9_]+}}/g)].map((match) => match[0]);
  if (unresolved.length) throw new Error(`Build failed: unresolved template tokens: ${unresolved.join(', ')}`);

  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  await Promise.all([
    writeFile(path.join(DIST, 'index.html'), output),
    cp(path.join(ROOT, 'site', 'styles.css'), path.join(DIST, 'styles.css')),
    cp(path.join(ROOT, 'site', 'app.js'), path.join(DIST, 'app.js')),
    writeFile(path.join(DIST, '.nojekyll'), ''),
  ]);

  console.log(`Built dist/: ${intro.lifts.length} lifts, ${resourceCount} searchable resources, ${linkCount} README links.`);
}

await build();
