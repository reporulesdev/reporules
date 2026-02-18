import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Read reporules.ignore file and return list of patterns to exclude
 */
export function readIgnoreFile(projectPath: string): string[] {
  const ignoreFilePath = join(projectPath, 'reporules.ignore');

  // If file doesn't exist, return empty array
  if (!existsSync(ignoreFilePath)) {
    return [];
  }

  try {
    const content = readFileSync(ignoreFilePath, 'utf-8');

    // Parse ignore patterns
    const patterns = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => {
        // Skip empty lines and comments
        return line.length > 0 && !line.startsWith('#');
      });

    return patterns;
  } catch (err) {
    console.warn(`Warning: Could not read reporules.ignore file: ${err}`);
    return [];
  }
}
