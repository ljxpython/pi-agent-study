import assert from 'node:assert/strict';
import test from 'node:test';
import { validateDoc, validateSiteCollections } from './validate-content.mjs';

const mockSite = {
  title: 'Test',
  description: 'Test site',
  author: 'Author',
  url: 'https://example.com',
  base: '/knowledge-site-template',
  repositoryUrl: 'https://github.com/example/test',
  accent: { primary: '#000', soft: '#fff' },
  navigation: { label: 'Test', sourceLabel: 'Source' },
  links: { github: 'https://github.com' },
  collections: [
    { id: 'notes', title: 'Notes', description: 'Example notes.', order: 1 },
    { id: 'course', title: 'Course', description: 'Example course.', order: 2, sectionMode: 'collapsible' },
  ],
};

test('accepts valid collections configuration', () => {
  assert.doesNotThrow(() => validateSiteCollections(mockSite));
});

test('accepts complete document metadata with valid resources', () => {
  assert.doesNotThrow(() => validateDoc('welcome', {
    title: 'Welcome',
    description: 'A valid note.',
    collection: 'notes',
    order: 1,
    published: true,
    resources: [{ label: 'Example', url: '/knowledge-site-template/examples/utf8-example.py' }],
  }, mockSite));
});

test('rejects missing and unsafe site-local resources', () => {
  const document = { collection: 'notes', title: 'Welcome', description: 'A valid note.', order: 1, published: true };

  for (const url of ['/knowledge-site-template/examples/missing.py', '/knowledge-site-template/examples/%2e%2e/package.json', '/outside/examples/utf8-example.py']) {
    assert.throws(() => validateDoc('welcome', { ...document, resources: [{ label: 'Broken', url }] }, mockSite), /invalid resource/);
  }
});

test('rejects unsupported section modes', () => {
  assert.throws(() => validateSiteCollections({
    ...mockSite,
    collections: [{ id: 'notes', title: 'Notes', description: 'Example notes.', order: 1, sectionMode: 'expanded' }],
  }), /invalid sectionMode/);
});

test('rejects incomplete document metadata', () => {
  assert.throws(() => validateDoc('broken', {
    title: 'Missing required fields',
  }, mockSite), /requires title/);
});

test('rejects documents in unknown collections', () => {
  assert.throws(() => validateDoc('welcome', {
    collection: 'missing',
    title: 'Welcome',
    description: 'A valid note.',
    order: 1,
    published: true,
  }, mockSite), /unknown collection/);
});
