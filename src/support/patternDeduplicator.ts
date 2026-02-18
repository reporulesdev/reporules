/**
 *
 *  -> 지우기 후보, 일단 지켜봄. ㅇㅇ
 * Pattern Deduplication
 *
 * Reduces redundant file patterns from LLM output.
 * Example: extensions/discord/package.json, extensions/slack/package.json... (50 files)
 * → Keep only 2-3 representative samples
 */

interface PatternGroup {
  pattern: string; // e.g., "extensions/*/package.json"
  files: string[]; // All files matching this pattern
}

/**
 * Deduplicates file patterns by detecting repeated structures
 *
 * @param files - Array of file paths from LLM analysis
 * @returns Deduplicated array with representative samples
 *
 * @example
 * Input: [
 *   "package.json",
 *   "extensions/discord/package.json",
 *   "extensions/slack/package.json",
 *   ... (50 extension files)
 * ]
 * Output: [
 *   "package.json",
 *   "extensions/discord/package.json",
 *   "extensions/slack/package.json",
 *   "extensions/telegram/package.json"
 * ]
 */
export function deduplicateFilePatterns(files: string[]): string[] {
  // 1. Separate root-level files (always kept)
  const rootFiles = files.filter((f) => !f.includes('/'));
  const nestedFiles = files.filter((f) => f.includes('/'));

  // 2. Group nested files by pattern
  const groups = groupByPattern(nestedFiles);

  // 3. Deduplicate each group
  const deduplicatedNested = groups.flatMap((group) => {
    // If 10+ files with same pattern → keep only 3 representatives
    if (group.files.length >= 10) {
      return group.files.slice(0, 3);
    }
    // Otherwise keep all
    return group.files;
  });

  // 4. Combine root + deduplicated nested
  return [...rootFiles, ...deduplicatedNested];
}

/**
 * Groups files by common pattern
 *
 * Example:
 * - Input: ["extensions/discord/package.json", "extensions/slack/package.json"]
 * - Output: [{ pattern: "extensions/wildcard/package.json", files: [...] }]
 */
function groupByPattern(files: string[]): PatternGroup[] {
  const patternMap = new Map<string, string[]>();

  for (const file of files) {
    const pattern = extractPattern(file);
    if (!patternMap.has(pattern)) {
      patternMap.set(pattern, []);
    }
    patternMap.get(pattern)!.push(file);
  }

  return Array.from(patternMap.entries()).map(([pattern, matchedFiles]) => ({
    pattern,
    files: matchedFiles,
  }));
}

/**
 * Extracts pattern from file path by wildcarding variable parts
 *
 * Examples:
 * - "extensions/discord/package.json" becomes "extensions/wildcard/package.json"
 * - "modules/api/src/config.ts" becomes "modules/wildcard/src/config.ts"
 * - "build.gradle.kts" stays as "build.gradle.kts" (no pattern)
 */
function extractPattern(filePath: string): string {
  const parts = filePath.split('/');

  // Short paths (1-2 parts) are returned as-is
  if (parts.length <= 1) {
    return filePath;
  }

  // For 2-part paths like "src/index.ts", return as-is
  // (not a repeated pattern, just a simple nested file)
  if (parts.length === 2) {
    return filePath;
  }

  // For longer paths, create pattern by wildcarding middle directories
  // Example: extensions/discord/package.json → extensions/*/package.json
  // Example: modules/api/src/config.ts → modules/*/src/config.ts
  const first = parts[0];
  const last = parts[parts.length - 1];
  const middle = parts.slice(1, -1);

  // Replace first variable directory with *
  // Keep deeper structure intact
  if (middle.length === 1) {
    return `${first}/*/${last}`;
  } else {
    // For deeper structures, wildcard only the first variable part
    const remainingMiddle = middle.slice(1).join('/');
    return `${first}/*/${remainingMiddle}/${last}`;
  }
}
