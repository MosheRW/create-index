# @mosherw/create-index

> Automatically generate `index.ts` barrel files for TypeScript projects.

[![npm version](https://img.shields.io/npm/v/@mosherw/create-index.svg)](https://www.npmjs.com/package/@mosherw/create-index)
[![Node.js](https://img.shields.io/node/v/@mosherw/create-index.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Usage](#usage)
- [Flags](#flags)
- [Examples](#examples)
- [Programmatic API](#programmatic-api)
- [File Processing Rules](#file-processing-rules)
- [Generated Output](#generated-output)

---

## Overview

`create-index` scans a directory and generates an `index.ts` barrel file that re-exports all TypeScript modules. This lets consumers import from a single entry point instead of individual file paths.

```ts
// Before: individual imports
import { Foo } from './foo';
import { Bar } from './bar';
import { Baz } from './baz';

// After: one import from the barrel
import { Foo, Bar, Baz } from '.';
```

---

## Installation

```bash
# Global (recommended for CLI use)
npm install -g @mosherw/create-index

# Local (project-level)
npm install --save-dev @mosherw/create-index
```

**Requires Node.js >= 18.3.0**

---

## Usage

```bash
create-index [path] [options]
```

If `path` is omitted, the current working directory is used.

---

## Flags

| Flag | Short | Type | Default | Description |
|---|---|---|---|---|
| `--recursive` | `-r` | boolean | `false` | Recursively generate `index.ts` in all subdirectories |
| `--recursive-limit=<n>` | — | number | unlimited | Maximum recursion depth (requires `--recursive`) |
| `--include-tests` | — | boolean | `false` | Include `*.spec.ts`, `*.test.ts`, `*.spec.tsx`, `*.test.tsx` files |
| `--help` | `-h` | boolean | — | Show help and exit |

---

### `--recursive` / `-r`

Recursively process all subdirectories and generate an `index.ts` in each one. Without this flag, only subdirectories that already contain an `index.ts` are exported.

```bash
create-index ./src --recursive
create-index ./src -r
```

---

### `--recursive-limit=<n>`

Limit how deep the recursion goes. Must be a non-negative integer. Requires `--recursive`.

| Value | Behavior |
|---|---|
| `0` | Root directory only (same as no `--recursive`) |
| `1` | Root + immediate subdirectories |
| `2` | Root + two levels deep |
| _(omitted)_ | Unlimited depth |

```bash
create-index ./src --recursive --recursive-limit=2
create-index ./src -r --recursive-limit=1
```

> **Error:** Using `--recursive-limit` without `--recursive` exits with an error.

---

### `--include-tests`

By default, test files are excluded from exports. Pass this flag to include them.

Affected patterns: `*.spec.ts`, `*.test.ts`, `*.spec.tsx`, `*.test.tsx`

```bash
create-index ./src --include-tests
create-index ./src --recursive --include-tests
```

---

### `--help` / `-h`

Print usage information and exit.

```bash
create-index --help
create-index -h
```

---

## Examples

**Generate a barrel for a single directory:**
```bash
create-index ./src
```

**Recursively generate barrels for all subdirectories:**
```bash
create-index ./src --recursive
```

**Limit recursion to 2 levels deep:**
```bash
create-index ./src -r --recursive-limit=2
```

**Include test files in the barrel:**
```bash
create-index ./src --recursive --include-tests
```

**Run on the current directory:**
```bash
create-index
```

---

## Programmatic API

You can also use `create-index` as a Node.js module.

```ts
import { generateIndex } from '@mosherw/create-index';

// Basic
await generateIndex('./src');

// With options
await generateIndex('./src', {
  recursive: true,
  recursiveLimit: 2,
  includeTests: false,
});

// With custom overwrite confirmation
await generateIndex(
  './src',
  { recursive: true },
  async (indexPath) => {
    // Return true to overwrite, false to skip
    return true;
  }
);

// Force overwrite without prompting
await generateIndex('./src', { recursive: true, force: true });
```

### `generateIndex(dirPath, options?, confirmOverwrite?)`

| Parameter | Type | Description |
|---|---|---|
| `dirPath` | `string` | Directory to process |
| `options` | `GeneratorOptions` | Optional configuration |
| `confirmOverwrite` | `(path: string) => Promise<boolean>` | Custom overwrite prompt |

### `GeneratorOptions`

```ts
interface GeneratorOptions {
  recursive?: boolean;      // Default: false
  recursiveLimit?: number;  // Default: undefined (unlimited)
  includeTests?: boolean;   // Default: false
  force?: boolean;          // Default: false — skip overwrite prompt
}
```

---

## File Processing Rules

**Included in exports:**
- `*.ts` and `*.tsx` files
- Subdirectories that have (or will have) an `index.ts`

**Excluded from exports:**
- `index.ts` / `index.tsx` — the barrel file itself
- `*.d.ts` / `*.d.tsx` — type declaration files
- `*.spec.ts`, `*.test.ts`, `*.spec.tsx`, `*.test.tsx` — test files _(unless `--include-tests` is set)_

**Skipped directories:**
- Directories starting with `.` (hidden directories)
- `node_modules`

Exports are sorted **alphabetically**.

---

## Generated Output

For a directory containing `alpha.ts`, `beta.ts`, and `utils.ts`:

```ts
export * from './alpha';
export * from './beta';
export * from './utils';
```

If no exportable files are found:

```ts
// No exports found
```

**Overwrite behavior (CLI):** If `index.ts` already exists, you will be prompted:
```
File already exists: src/index.ts
Overwrite? [y/N]
```
Only `y` (case-insensitive) confirms the overwrite. Anything else skips the file.

---

## Error Reference

| Scenario | Error Message |
|---|---|
| More than one path argument | `too many arguments. Expected at most one path.` |
| `--recursive-limit` without `--recursive` | `--recursive-limit requires --recursive / -r` |
| Invalid `--recursive-limit` value | `--recursive-limit must be a non-negative integer, got: <value>` |

All errors exit with code `1`.

---

## Repository

[https://github.com/MosheRW/create-index](https://github.com/MosheRW/create-index)
