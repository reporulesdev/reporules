import { join } from 'path';

/**
 * Absolute path to the reporules package root.
 *
 * This file lives at src/support/ (ts-node) or dist/support/ (compiled),
 * so two levels up is always the package root regardless of how the
 * package is run (dev, local build, or npm global install).
 */
const PACKAGE_ROOT = join(__dirname, '..', '..');

/**
 * Resolve a path relative to the reporules package root.
 *
 * @example
 * resolvePackagePath('templates', 'go-clean-architecture')
 * resolvePackagePath('prompts', 'some-prompt.md')
 */
export function resolvePackagePath(...segments: string[]): string {
  return join(PACKAGE_ROOT, ...segments);
}
