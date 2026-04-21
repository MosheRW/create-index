import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test, describe } from 'node:test';
import { strictEqual, match, doesNotMatch } from 'node:assert/strict';
import { generateIndex } from './generator.js';

async function createFixture(structure: Record<string, string | null>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'ts-barrel-test-'));
  for (const [relPath, content] of Object.entries(structure)) {
    const abs = join(dir, relPath);
    if (relPath.endsWith('/')) {
      await mkdir(abs, { recursive: true });
    } else {
      await mkdir(join(abs, '..'), { recursive: true });
      await writeFile(abs, content ?? '', 'utf8');
    }
  }
  return dir;
}

async function readIndex(dir: string): Promise<string> {
  return readFile(join(dir, 'index.ts'), 'utf8');
}

const FORCE = { force: true };

describe('generateIndex', () => {
  test('generates exports for .ts files', async () => {
    const dir = await createFixture({ 'foo.ts': '', 'bar.ts': '' });
    await generateIndex(dir, FORCE);
    const content = await readIndex(dir);
    match(content, /export \* from '\.\/bar';/);
    match(content, /export \* from '\.\/foo';/);
    await rm(dir, { recursive: true });
  });

  test('excludes index.ts itself', async () => {
    const dir = await createFixture({ 'index.ts': 'old', 'foo.ts': '' });
    await generateIndex(dir, FORCE);
    const content = await readIndex(dir);
    doesNotMatch(content, /from '\.\/index'/);
    await rm(dir, { recursive: true });
  });

  test('excludes .d.ts files', async () => {
    const dir = await createFixture({ 'foo.d.ts': '', 'bar.ts': '' });
    await generateIndex(dir, FORCE);
    const content = await readIndex(dir);
    doesNotMatch(content, /from '\.\/foo'/);
    match(content, /from '\.\/bar'/);
    await rm(dir, { recursive: true });
  });

  test('excludes spec and test files by default', async () => {
    const dir = await createFixture({ 'foo.spec.ts': '', 'foo.test.ts': '', 'bar.ts': '' });
    await generateIndex(dir, FORCE);
    const content = await readIndex(dir);
    doesNotMatch(content, /from '\.\/foo\.spec'/);
    doesNotMatch(content, /from '\.\/foo\.test'/);
    match(content, /from '\.\/bar'/);
    await rm(dir, { recursive: true });
  });

  test('includes spec and test files with includeTests', async () => {
    const dir = await createFixture({ 'foo.spec.ts': '', 'foo.test.ts': '' });
    await generateIndex(dir, { ...FORCE, includeTests: true });
    const content = await readIndex(dir);
    match(content, /from '\.\/foo\.spec'/);
    match(content, /from '\.\/foo\.test'/);
    await rm(dir, { recursive: true });
  });

  test('skips hidden directories', async () => {
    const dir = await createFixture({ '.hidden/': null, 'bar.ts': '' });
    await generateIndex(dir, FORCE);
    const content = await readIndex(dir);
    doesNotMatch(content, /from '\.\/.hidden'/);
    await rm(dir, { recursive: true });
  });

  test('skips node_modules', async () => {
    const dir = await createFixture({ 'node_modules/': null, 'foo.ts': '' });
    await generateIndex(dir, FORCE);
    const content = await readIndex(dir);
    doesNotMatch(content, /from '\.\/node_modules'/);
    await rm(dir, { recursive: true });
  });

  test('exports subdir only when it has index.ts (non-recursive)', async () => {
    const dir = await createFixture({
      'utils/index.ts': 'export const x = 1;',
      'helpers/': null,
    });
    await generateIndex(dir, FORCE);
    const content = await readIndex(dir);
    match(content, /from '\.\/utils'/);
    doesNotMatch(content, /from '\.\/helpers'/);
    await rm(dir, { recursive: true });
  });

  test('recursive: generates index.ts in subdirs', async () => {
    const dir = await createFixture({ 'foo.ts': '', 'utils/bar.ts': '' });
    await generateIndex(dir, { ...FORCE, recursive: true });
    const rootContent = await readIndex(dir);
    const subContent = await readFile(join(dir, 'utils', 'index.ts'), 'utf8');
    match(rootContent, /from '\.\/utils'/);
    match(subContent, /from '\.\/bar'/);
    await rm(dir, { recursive: true });
  });

  test('recursive-limit: stops at specified depth', async () => {
    const dir = await createFixture({ 'a/b/deep.ts': '' });
    await generateIndex(dir, { ...FORCE, recursive: true, recursiveLimit: 1 });
    // depth 0 = root dir, depth 1 = a/ (recursed), depth 2 = b/ (NOT recursed)
    // b/ has no index.ts, so a/index.ts should not export b
    const aContent = await readFile(join(dir, 'a', 'index.ts'), 'utf8');
    doesNotMatch(aContent, /from '\.\/b'/);
    await rm(dir, { recursive: true });
  });

  test('empty directory writes no-export comment', async () => {
    const dir = await createFixture({});
    await generateIndex(dir, FORCE);
    const content = await readIndex(dir);
    strictEqual(content, '// No exports found\n');
    await rm(dir, { recursive: true });
  });

  test('skips overwrite when confirmOverwrite returns false', async () => {
    const dir = await createFixture({ 'foo.ts': '', 'index.ts': 'original\n' });
    await generateIndex(dir, {}, () => Promise.resolve(false));
    const content = await readFile(join(dir, 'index.ts'), 'utf8');
    strictEqual(content, 'original\n');
    await rm(dir, { recursive: true });
  });

  test('overwrites when confirmOverwrite returns true', async () => {
    const dir = await createFixture({ 'foo.ts': '', 'index.ts': 'original\n' });
    await generateIndex(dir, {}, () => Promise.resolve(true));
    const content = await readFile(join(dir, 'index.ts'), 'utf8');
    match(content, /from '\.\/foo'/);
    await rm(dir, { recursive: true });
  });

  test('output is sorted alphabetically', async () => {
    const dir = await createFixture({ 'zebra.ts': '', 'alpha.ts': '', 'mango.ts': '' });
    await generateIndex(dir, FORCE);
    const content = await readIndex(dir);
    const lines = content.trim().split('\n');
    strictEqual(lines[0], "export * from './alpha';");
    strictEqual(lines[1], "export * from './mango';");
    strictEqual(lines[2], "export * from './zebra';");
    await rm(dir, { recursive: true });
  });
});
