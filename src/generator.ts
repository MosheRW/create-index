import { readdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

export interface GeneratorOptions {
  /** Recursively generate index.ts in subdirectories. */
  recursive?: boolean;
  /**
   * Maximum recursion depth (0 = root only). Only meaningful when recursive is true.
   * Undefined means unlimited.
   */
  recursiveLimit?: number;
  /** Include *.spec.ts and *.test.ts files in exports. Default: false. */
  includeTests?: boolean;
  /**
   * Skip the interactive overwrite confirmation.
   * Used by the programmatic API when the caller handles confirmation itself.
   */
  force?: boolean;
}

const SKIP_DIRS = new Set(['node_modules']);

function isExportableFile(name: string, includeTests: boolean): boolean {
  if (!name.endsWith('.ts')) return false;
  if (name === 'index.ts') return false;
  if (name.endsWith('.d.ts')) return false;
  if (!includeTests && (name.endsWith('.spec.ts') || name.endsWith('.test.ts'))) return false;
  return true;
}

function stem(filename: string): string {
  return filename.slice(0, -3);
}

function buildBarrelContent(fileStems: string[], dirNames: string[]): string {
  const fileLines = fileStems.slice().sort().map(s => `export * from './${s}';`);
  const dirLines = dirNames.slice().sort().map(d => `export * from './${d}';`);
  const all = [...fileLines, ...dirLines];
  if (all.length === 0) {
    return '// No exports found\n';
  }
  return all.join('\n') + '\n';
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw err;
  }
}

async function generateIndexInDir(
  dirPath: string,
  options: Required<Omit<GeneratorOptions, 'recursiveLimit'>> & { recursiveLimit: number | undefined },
  depth: number,
  confirmOverwrite: (indexPath: string) => Promise<boolean>,
): Promise<void> {
  const entries = await readdir(dirPath, { withFileTypes: true });

  const fileStems: string[] = [];
  const dirNames: string[] = [];

  for (const entry of entries) {
    if (entry.isFile()) {
      if (isExportableFile(entry.name, options.includeTests)) {
        fileStems.push(stem(entry.name));
      }
    } else if (entry.isDirectory()) {
      const name = entry.name;
      if (name.startsWith('.') || SKIP_DIRS.has(name)) continue;

      const subPath = join(dirPath, name);
      const withinDepthLimit =
        options.recursiveLimit === undefined || depth < options.recursiveLimit;

      if (options.recursive && withinDepthLimit) {
        // Recurse first so the child's index.ts exists before the parent exports it
        await generateIndexInDir(subPath, options, depth + 1, confirmOverwrite);
        dirNames.push(name);
      } else {
        // Only export the subdir if it already has an index.ts
        if (await pathExists(join(subPath, 'index.ts'))) {
          dirNames.push(name);
        }
      }
    }
  }

  const indexPath = join(dirPath, 'index.ts');
  const content = buildBarrelContent(fileStems, dirNames);

  const exists = await pathExists(indexPath);
  if (exists && !options.force) {
    const confirmed = await confirmOverwrite(indexPath);
    if (!confirmed) {
      console.log(`Skipped: ${indexPath}`);
      return;
    }
  }

  await writeFile(indexPath, content, 'utf8');
  console.log(`Written: ${indexPath}`);
}

/**
 * Generate an index.ts barrel file for the given directory.
 *
 * @param dirPath          Absolute or relative path to the target directory.
 * @param options          Generation options.
 * @param confirmOverwrite Called when index.ts already exists and force is false.
 *                         Return true to overwrite, false to skip.
 */
export async function generateIndex(
  dirPath: string,
  options: GeneratorOptions = {},
  confirmOverwrite: (indexPath: string) => Promise<boolean> = () => Promise.resolve(false),
): Promise<void> {
  if (
    options.recursiveLimit !== undefined &&
    (!Number.isInteger(options.recursiveLimit) || options.recursiveLimit < 0)
  ) {
    throw new RangeError('--recursive-limit must be a non-negative integer');
  }

  await generateIndexInDir(
    dirPath,
    {
      recursive: options.recursive ?? false,
      recursiveLimit: options.recursiveLimit,
      includeTests: options.includeTests ?? false,
      force: options.force ?? false,
    },
    0,
    confirmOverwrite,
  );
}
