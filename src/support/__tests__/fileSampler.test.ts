import { readSampleFiles } from '../fileSampler';
import { FileInfo } from '../../data/types';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

describe('fileSampler', () => {
  const TEST_DIR = join(__dirname, '__test_fixtures__');

  // Helper to create FileInfo
  const createFileInfo = (relativePath: string): FileInfo => ({
    path: join(TEST_DIR, relativePath),
    relativePath,
    name: relativePath.split('/').pop() || relativePath,
    type: 'file',
    depth: 1
  });

  beforeEach(() => {
    // Create test directory
    if (!require('fs').existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (require('fs').existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('readSampleFiles', () => {
    it('should read files successfully', async () => {
      // Setup: Create test file
      const testFile = join(TEST_DIR, 'test.ts');
      writeFileSync(testFile, 'line1\nline2\nline3');

      const files: FileInfo[] = [createFileInfo('test.ts')];

      // Execute
      const result = await readSampleFiles(files, TEST_DIR, 300);

      // Verify
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        path: 'test.ts',
        content: 'line1\nline2\nline3',
        lines: 3
      });
    });

    it('should truncate files exceeding maxLinesPerFile', async () => {
      // Setup: Create file with 350 lines
      const lines = Array.from({ length: 350 }, (_, i) => `line${i + 1}`);
      const testFile = join(TEST_DIR, 'long.ts');
      writeFileSync(testFile, lines.join('\n'));

      const files: FileInfo[] = [createFileInfo('long.ts')];

      // Execute with maxLinesPerFile = 300
      const result = await readSampleFiles(files, TEST_DIR, 300);

      // Verify
      expect(result).toHaveLength(1);
      expect(result[0].lines).toBe(300);
      expect(result[0].content).toContain('... (truncated, 50 more lines)');
      expect(result[0].content).toContain('line1');
      expect(result[0].content).toContain('line300');
      expect(result[0].content).not.toContain('line301');
    });

    it('should handle multiple files', async () => {
      // Setup: Create multiple files
      writeFileSync(join(TEST_DIR, 'file1.ts'), 'content1');
      writeFileSync(join(TEST_DIR, 'file2.ts'), 'content2');
      writeFileSync(join(TEST_DIR, 'file3.ts'), 'content3');

      const files: FileInfo[] = [
        createFileInfo('file1.ts'),
        createFileInfo('file2.ts'),
        createFileInfo('file3.ts')
      ];

      // Execute
      const result = await readSampleFiles(files, TEST_DIR, 300);

      // Verify
      expect(result).toHaveLength(3);
      expect(result[0].path).toBe('file1.ts');
      expect(result[1].path).toBe('file2.ts');
      expect(result[2].path).toBe('file3.ts');
    });

    it('should skip non-existent files and warn', async () => {
      // Setup: Mix of existing and non-existing files
      writeFileSync(join(TEST_DIR, 'exists.ts'), 'content');

      const files: FileInfo[] = [
        createFileInfo('exists.ts'),
        createFileInfo('not-exists.ts')
      ];

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Execute
      const result = await readSampleFiles(files, TEST_DIR, 300);

      // Verify
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('exists.ts');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to read not-exists.ts'));
      expect(warnSpy).toHaveBeenCalledWith('⚠️  1/2 files failed to read');

      warnSpy.mockRestore();
    });

    it('should throw error if 3+ files fail in small sets (< 5 files)', async () => {
      const files: FileInfo[] = [
        createFileInfo('not-exists1.ts'),
        createFileInfo('not-exists2.ts'),
        createFileInfo('not-exists3.ts')
      ];

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Execute & Verify
      await expect(readSampleFiles(files, TEST_DIR, 300))
        .rejects.toThrow('Failed to read 3/3 sample files (critical threshold for small sets)');

      warnSpy.mockRestore();
    });

    it('should throw error if all files fail in large sets (>= 5 files)', async () => {
      const files: FileInfo[] = [
        createFileInfo('not-exists1.ts'),
        createFileInfo('not-exists2.ts'),
        createFileInfo('not-exists3.ts'),
        createFileInfo('not-exists4.ts'),
        createFileInfo('not-exists5.ts')
      ];

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Execute & Verify
      await expect(readSampleFiles(files, TEST_DIR, 300))
        .rejects.toThrow('Failed to read all 5 sample files');

      warnSpy.mockRestore();
    });

    it('should not throw error if some files succeed in large sets', async () => {
      // Setup: Create 1 valid file out of 5
      writeFileSync(join(TEST_DIR, 'exists.ts'), 'content');

      const files: FileInfo[] = [
        createFileInfo('exists.ts'),
        createFileInfo('not-exists1.ts'),
        createFileInfo('not-exists2.ts'),
        createFileInfo('not-exists3.ts'),
        createFileInfo('not-exists4.ts')
      ];

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Execute
      const result = await readSampleFiles(files, TEST_DIR, 300);

      // Verify: Should succeed with 1 file
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('exists.ts');

      warnSpy.mockRestore();
    });

    it('should handle empty input array', async () => {
      const files: FileInfo[] = [];

      // Execute
      const result = await readSampleFiles(files, TEST_DIR, 300);

      // Verify
      expect(result).toHaveLength(0);
    });

    it('should respect custom maxLinesPerFile parameter', async () => {
      // Setup: Create file with 100 lines
      const lines = Array.from({ length: 100 }, (_, i) => `line${i + 1}`);
      writeFileSync(join(TEST_DIR, 'test.ts'), lines.join('\n'));

      const files: FileInfo[] = [createFileInfo('test.ts')];

      // Execute with maxLinesPerFile = 50
      const result = await readSampleFiles(files, TEST_DIR, 50);

      // Verify
      expect(result[0].lines).toBe(50);
      expect(result[0].content).toContain('... (truncated, 50 more lines)');
    });
  });
});
