import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const README_PATH = path.join(ROOT, 'README.md');
const TEMPLATE_PATH = path.join(ROOT, 'site', 'template.html');
const CONFIG_PATH = path.join(ROOT, 'site', 'config.json');
const DIST_PATH = path.join(ROOT, 'dist');

function parseSiteConfig(source) {
  let config;

  try {
    config = JSON.parse(source);
  } catch (error) {
    throw new Error(`Build failed: site/config.json is invalid JSON: ${error.message}`);
  }

  if (typeof config.renderLeadImage !== 'boolean') {
    throw new Error('Build failed: site/config.json must define renderLeadImage as true or false.');
  }

  return config;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function slugify(value = '') {
  return stripMarkdown(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

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

function renderInline(markdown, { classifyLinks = false } = {}) {
  const tokens = [];
  let tokenIndex = 0;
  let linkIndex = 0;

  const stash = (html) => {
    const key = `@@TOKEN_${tokenIndex++}@@`;
    tokens.push([key, html]);
    return key;
  };

  let value = String(markdown);

  value = value.replace(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g, (_, alt, url) => (
    stash(`<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy">`)
  ));

  value = value.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_, label, url) => {
    const className = classifyLinks
      ? (linkIndex++ === 0 ? 'primary-link' : 'utility-link')
      : '';
    const classAttribute = className ? ` class="${className}"` : '';
    return stash(`<a${classAttribute} href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`);
  });

  value = escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  for (const [key, html] of tokens) value = value.replaceAll(key, html);
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

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    const listItem = line.match(/^(\s*)-\s+(.+)$/);
    const image = line.trim().match(/^!\[([^\]]*)\]\((https?:\/\/[^)]+)\)\s*$/);

    if (heading) {
      flushParagraph();
      blocks.push({
        type: 'heading',
        level: heading[1].length,
        raw: heading[2],
        text: stripMarkdown(heading[2]),
      });
      continue;
    }

    if (listItem) {
      flushParagraph();
      blocks.push({
        type: 'listItem',
        indent: listItem[1].replace(/\t/g, '    ').length,
        text: listItem[2].trim(),
      });
      continue;
    }

    if (image) {
      flushParagraph();
      blocks.push({ type: 'image', alt: image[1], url: image[2] });
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  return blocks;
}

function splitDocument(blocks) {
  const titleIndex = blocks.findIndex((block) => block.type === 'heading' && block.level === 1);
  if (titleIndex < 0) throw new Error('Build failed: README.md does not contain a level-one title.');

  const title = blocks[titleIndex].text;
  const leadBlocks = [];
  const sections = [];
  let currentSection = null;

  for (const block of blocks.slice(titleIndex + 1)) {
    if (block.type === 'heading' && block.level === 1) {
      currentSection = {
        title: block.text,
        rawTitle: block.raw,
        id: slugify(block.text),
        blocks: [],
      };
      sections.push(currentSection);
      continue;
    }

    if (currentSection) currentSection.blocks.push(block);
    else leadBlocks.push(block);
  }

  return { title, leadBlocks, sections };
}

function groupSectionBlocks(blocks) {
  const groups = [];
  const headingStack = [];
  let current = { heading: null, ancestors: [], blocks: [] };

  const flush = () => {
    if (current.heading || current.blocks.length) groups.push(current);
    current = { heading: null, ancestors: [], blocks: [] };
  };

  for (const block of blocks) {
    if (block.type === 'heading' && block.level >= 2) {
      flush();
      while (headingStack.length && headingStack.at(-1).level >= block.level) headingStack.pop();
      current.heading = block;
      current.ancestors = [...headingStack];
      headingStack.push(block);
    } else {
      current.blocks.push(block);
    }
  }

  flush();
  return groups;
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

function nodeText(node) {
  return [node.text, ...node.children.map(nodeText)].join(' ');
}

function renderList(nodes, { searchable = false, context = '' } = {}) {
  const renderNode = (node, topLevel) => {
    const classes = ['document-list-item'];
    if (topLevel) classes.push('resource-item');
    else classes.push('resource-note');

    const searchAttribute = searchable && topLevel
      ? ` data-resource="true" data-search="${escapeHtml(stripMarkdown(`${context} ${nodeText(node)}`).toLowerCase())}"`
      : '';

    const children = node.children.length
      ? `<ul class="document-list nested-list">${node.children.map((child) => renderNode(child, false)).join('')}</ul>`
      : '';

    return `<li class="${classes.join(' ')}"${searchAttribute}><div class="resource-line">${renderInline(node.text, { classifyLinks: topLevel })}</div>${children}</li>`;
  };

  return `<ul class="document-list">${nodes.map((node) => renderNode(node, true)).join('')}</ul>`;
}

function renderImage(block, className = 'document-image') {
  const url = block.url.startsWith('http://') ? `https://${block.url.slice(7)}` : block.url;
  return `<figure class="${className}"><img src="${escapeHtml(url)}" alt="${escapeHtml(block.alt)}" loading="lazy"></figure>`;
}

function renderGroup(group, section, searchable) {
  const heading = group.heading;
  const groupId = heading ? `${section.id}-${slugify(heading.text)}` : '';
  const headingTag = heading ? `h${Math.min(heading.level + 1, 6)}` : '';
  const headingHtml = heading
    ? `<${headingTag} class="group-heading level-${heading.level}" id="${groupId}">${renderInline(heading.raw)}</${headingTag}>`
    : '';

  const content = [];
  for (let index = 0; index < group.blocks.length; index += 1) {
    const block = group.blocks[index];

    if (block.type === 'listItem') {
      const listBlocks = [block];
      while (group.blocks[index + 1]?.type === 'listItem') {
        index += 1;
        listBlocks.push(group.blocks[index]);
      }
      content.push(renderList(buildListTree(listBlocks), {
        searchable,
        context: `${section.title} ${group.ancestors.map((ancestor) => ancestor.text).join(' ')} ${heading?.text || ''}`,
      }));
      continue;
    }

    if (block.type === 'paragraph') {
      content.push(`<p>${renderInline(block.text)}</p>`);
      continue;
    }

    if (block.type === 'image') content.push(renderImage(block));
  }

  const searchAttribute = searchable ? ' data-search-group="true"' : '';
  const levelAttribute = heading ? ` data-heading-level="${heading.level}"` : '';
  return `<div class="content-group${heading ? '' : ' content-group-intro'}"${searchAttribute}${levelAttribute}>${headingHtml}${content.join('\n')}</div>`;
}

function renderSection(section) {
  const searchable = section.title.toLowerCase() !== 'introduction';
  const groups = groupSectionBlocks(section.blocks);
  const searchAttribute = searchable ? ' data-search-section="true"' : '';

  return `<section class="document-section" id="${section.id}" data-section="${section.id}"${searchAttribute}>
    <header class="section-header"><h2>${renderInline(section.rawTitle)}</h2></header>
    <div class="section-content">${groups.map((group) => renderGroup(group, section, searchable)).join('\n')}</div>
  </section>`;
}

function countSectionResources(section) {
  return groupSectionBlocks(section.blocks).reduce((total, group) => {
    const listBlocks = group.blocks.filter((block) => block.type === 'listItem');
    return total + buildListTree(listBlocks).length;
  }, 0);
}

function renderNavigation(sections) {
  return sections.map((section) => (
    `<a class="toc-link" href="#${section.id}" data-section-link="${section.id}">${escapeHtml(section.title)}</a>`
  )).join('');
}

function getMetaDescription(sections) {
  const introduction = sections.find((section) => section.title.toLowerCase() === 'introduction');
  const paragraph = introduction?.blocks.find((block) => block.type === 'paragraph');
  const fallback = 'Kettlebell sport resources generated from README.md.';
  const description = stripMarkdown(paragraph?.text || fallback);
  return description.length > 160 ? `${description.slice(0, 157).trimEnd()}…` : description;
}

function renderLeadMedia(leadBlocks, renderLeadImage) {
  if (!renderLeadImage) return '';
  return leadBlocks
    .filter((block) => block.type === 'image')
    .map((block) => renderImage(block, 'lead-image'))
    .join('');
}

async function build() {
  const [source, template, configSource] = await Promise.all([
    readFile(README_PATH, 'utf8'),
    readFile(TEMPLATE_PATH, 'utf8'),
    readFile(CONFIG_PATH, 'utf8'),
  ]);

  const config = parseSiteConfig(configSource);
  const blocks = parseMarkdown(source);
  const { title, leadBlocks, sections } = splitDocument(blocks);
  const resourceSections = sections.filter((section) => section.title.toLowerCase() !== 'introduction');
  const resourceCount = resourceSections.reduce((total, section) => total + countSectionResources(section), 0);

  if (!title) throw new Error('Build failed: README title could not be determined.');
  if (!sections.length) throw new Error('Build failed: no README sections were found.');
  if (!sections.some((section) => section.title.toLowerCase() === 'introduction')) {
    throw new Error('Build failed: README.md must contain an Introduction section.');
  }
  if (!resourceCount) throw new Error('Build failed: no searchable resources were found.');

  const replacements = {
    SITE_TITLE: escapeHtml(title),
    META_DESCRIPTION: escapeHtml(getMetaDescription(sections)),
    NAV_LINKS: renderNavigation(sections),
    RESOURCE_COUNT: String(resourceCount),
    LEAD_MEDIA: renderLeadMedia(leadBlocks, config.renderLeadImage),
    DOCUMENT: sections.map(renderSection).join('\n'),
  };

  let output = template;
  for (const [key, value] of Object.entries(replacements)) {
    output = output.replaceAll(`{{${key}}}`, value);
  }

  const unresolved = [...output.matchAll(/{{[A-Z0-9_]+}}/g)].map((match) => match[0]);
  if (unresolved.length) {
    throw new Error(`Build failed: unresolved template tokens: ${unresolved.join(', ')}`);
  }

  await rm(DIST_PATH, { recursive: true, force: true });
  await mkdir(DIST_PATH, { recursive: true });
  await Promise.all([
    writeFile(path.join(DIST_PATH, 'index.html'), output),
    cp(path.join(ROOT, 'site', 'styles.css'), path.join(DIST_PATH, 'styles.css')),
    cp(path.join(ROOT, 'site', 'app.js'), path.join(DIST_PATH, 'app.js')),
    writeFile(path.join(DIST_PATH, '.nojekyll'), ''),
  ]);

  console.log(`Built dist/: ${sections.length} README sections and ${resourceCount} searchable resources.`);
}

await build();
