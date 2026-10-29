import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import site from '../site.config.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = resolve(root, 'content');
const publicDir = resolve(root, 'public');
const siteBase = site.base.replace(/\/$/, '');

export function validateSiteCollections(siteConfig = site) {
  if (!Array.isArray(siteConfig.collections) || siteConfig.collections.length === 0) {
    throw new Error('site.config.ts requires a non-empty collections array.');
  }

  const collectionIds = new Set();
  for (const col of siteConfig.collections) {
    if (!col.id || !col.title || !col.description || !Number.isInteger(col.order)) {
      throw new Error('Each collection requires id, title, description, and integer order.');
    }
    if (col.sourceUrl && !URL.canParse(col.sourceUrl)) {
      throw new Error(`Collection "${col.id}" has an invalid sourceUrl.`);
    }
    if (col.sectionMode && !['flat', 'collapsible'].includes(col.sectionMode)) {
      throw new Error(`Collection "${col.id}" has an invalid sectionMode.`);
    }
    collectionIds.add(col.id);
  }
  return collectionIds;
}

export function parseDoc(rawContent) {
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error('Missing frontmatter block (--- ... ---).');
  }
  const data = yaml.parse(match[1]) ?? {};
  const body = rawContent.slice(match[0].length);
  return { data, body };
}

function validateLocalResource(url, siteConfig = site) {
  const currentBase = (siteConfig?.base ?? site.base).replace(/\/$/, '');
  if (!url.startsWith(`${currentBase}/`)) {
    return false;
  }

  let relativePath;
  try {
    relativePath = decodeURIComponent(url.slice(currentBase.length + 1));
  } catch {
    return false;
  }
  if (!relativePath || relativePath.split('/').includes('..')) {
    return false;
  }

  const resourcePath = resolve(publicDir, relativePath);
  return resourcePath.startsWith(`${publicDir}/`) && existsSync(resourcePath);
}

export function validateDoc(id, data, siteConfig = site) {
  const validCollections = (siteConfig.collections ?? []).map((c) => c.id);

  if (!data.title || !data.description || !data.collection || !Number.isInteger(data.order) || typeof data.published !== 'boolean') {
    throw new Error(`Document "${id}" requires title, description, collection, integer order, and boolean published.`);
  }

  if (!validCollections.includes(data.collection)) {
    throw new Error(`Document "${id}" references unknown collection "${data.collection}". Valid collections: ${validCollections.join(', ')}`);
  }

  if (data.source && !URL.canParse(data.source)) {
    throw new Error(`Document "${id}" has an invalid source URL.`);
  }

  for (const resource of data.resources ?? []) {
    const isExternal = URL.canParse(resource.url);
    const isLocal = validateLocalResource(resource.url, siteConfig);
    if (!resource.label || (!isExternal && !isLocal)) {
      throw new Error(`Document "${id}" has an invalid resource entry.`);
    }
  }
}

export function validateAllContent(siteConfig = site) {
  validateSiteCollections(siteConfig);

  const files = readdirSync(contentDir).filter((file) => file.endsWith('.md'));
  for (const file of files) {
    const raw = readFileSync(resolve(contentDir, file), 'utf8');
    const { data, body } = parseDoc(raw);
    const id = file.replace(/\.md$/, '');
    validateDoc(id, data, siteConfig);

    for (const match of body.matchAll(/\]\((\/(?:imgs|pdfs)\/[^)\s]+)\)/g)) {
      const asset = resolve(publicDir, match[1].slice(1));
      if (!existsSync(asset)) {
        throw new Error(`${file} references missing asset ${match[1]}`);
      }
    }
  }
}
