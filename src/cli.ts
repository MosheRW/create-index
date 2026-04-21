#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { resolve } from 'node:path';
import { generateIndex } from './generator.js';

function printUsage(): void {
  console.log(`
Usage: ts-barrel [path] [options]

  path                    Directory to process (default: current working directory)

Options:
  -r, --recursive         Recursively generate index.ts in subdirectories
  --recursive-limit=<n>   Maximum recursion depth (requires --recursive)
  --include-tests         Include *.spec.ts and *.test.ts files in exports
  -h, --help              Show this help message
`.trim());
}

async function promptOverwrite(indexPath: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`File already exists: ${indexPath}\nOverwrite? [y/N] `);
    return answer.trim().toLowerCase() === 'y';
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: process.argv.slice(2),
      options: {
        recursive:         { type: 'boolean', short: 'r', default: false },
        'recursive-limit': { type: 'string' },
        'include-tests':   { type: 'boolean', default: false },
        help:              { type: 'boolean', short: 'h', default: false },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (err: unknown) {
    console.error(`Error: ${(err as Error).message}`);
    printUsage();
    process.exit(1);
  }

  if (parsed.values.help) {
    printUsage();
    process.exit(0);
  }

  if (parsed.positionals.length > 1) {
    console.error('Error: too many arguments. Expected at most one path.');
    printUsage();
    process.exit(1);
  }

  const targetDir = resolve(parsed.positionals[0] ?? process.cwd());

  const recursive = parsed.values.recursive as boolean;
  const includeTests = parsed.values['include-tests'] as boolean;
  const limitRaw = parsed.values['recursive-limit'] as string | undefined;

  let recursiveLimit: number | undefined;
  if (limitRaw !== undefined) {
    if (!recursive) {
      console.error('Error: --recursive-limit requires --recursive / -r');
      process.exit(1);
    }
    recursiveLimit = parseInt(limitRaw, 10);
    if (!Number.isInteger(recursiveLimit) || recursiveLimit < 0) {
      console.error(`Error: --recursive-limit must be a non-negative integer, got: ${limitRaw}`);
      process.exit(1);
    }
  }

  try {
    await generateIndex(
      targetDir,
      {
        recursive,
        recursiveLimit,
        includeTests,
        force: false,
      },
      promptOverwrite,
    );
  } catch (err: unknown) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
