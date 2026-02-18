import { FileInfo, SampleFile } from '../data/types';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Read sample files and return their contents
 */
export async function readSampleFiles(
  files: FileInfo[],
  projectRoot: string,
  maxLinesPerFile: number = 300
): Promise<SampleFile[]> {
  const sampleFiles: SampleFile[] = [];
  let failedCount = 0;

  for (const file of files) {
    try {
      const fullPath = join(projectRoot, file.relativePath);
      const content = readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');

      // Truncate if too long
      const truncatedContent = lines.length > maxLinesPerFile
        ? lines.slice(0, maxLinesPerFile).join('\n') + `\n\n... (truncated, ${lines.length - maxLinesPerFile} more lines)`
        : content;

      sampleFiles.push({
        path: file.relativePath,
        content: truncatedContent,
        lines: Math.min(lines.length, maxLinesPerFile),
      });
    } catch (error) {
      failedCount++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️  Failed to read ${file.relativePath}: ${errorMsg}`);
    }
  }

  // Summary of failures
  if (failedCount > 0) {
    console.warn(`⚠️  ${failedCount}/${files.length} files failed to read`);
  }

  // Throw error if critical failure
  // - No error if files.length === 0 (empty input is valid)
  // - For < 5 files: error if 3+ files failed
  // - For >= 5 files: error if all files failed
  if (files.length > 0) {
    if (files.length < 5 && failedCount >= 3) {
      throw new Error(
        `Failed to read ${failedCount}/${files.length} sample files (critical threshold for small sets). Check file permissions and paths.`
      );
    } else if (files.length >= 5 && sampleFiles.length === 0) {
      throw new Error(
        `Failed to read all ${files.length} sample files. Check file permissions and paths.`
      );
    }
  }

  return sampleFiles;
}
