import { readIgnoreFile } from '../ignoreReader';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

describe('ignoreReader', () => {
  const TEST_DIR = join(__dirname, '__test_fixtures__');

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

  describe('readIgnoreFile', () => {
    it('should return empty array when ignore file does not exist', () => {
      const result = readIgnoreFile(TEST_DIR);

      expect(result).toEqual([]);
    });

    it('should read basic patterns from ignore file', () => {
      const ignoreContent = `
node_modules
dist
*.log
      `.trim();

      writeFileSync(join(TEST_DIR, 'reporules.ignore'), ignoreContent);

      const result = readIgnoreFile(TEST_DIR);

      expect(result).toEqual(['node_modules', 'dist', '*.log']);
    });

    it('should skip empty lines', () => {
      const ignoreContent = `
node_modules

dist


*.log
      `.trim();

      writeFileSync(join(TEST_DIR, 'reporules.ignore'), ignoreContent);

      const result = readIgnoreFile(TEST_DIR);

      expect(result).toEqual(['node_modules', 'dist', '*.log']);
    });

    it('should skip comment lines starting with #', () => {
      const ignoreContent = `
# Dependencies
node_modules
# Build outputs
dist
# Logs
*.log
      `.trim();

      writeFileSync(join(TEST_DIR, 'reporules.ignore'), ignoreContent);

      const result = readIgnoreFile(TEST_DIR);

      expect(result).toEqual(['node_modules', 'dist', '*.log']);
    });

    it('should trim whitespace from patterns', () => {
      const ignoreContent = `
  node_modules
   dist
*.log
      `.trim();

      writeFileSync(join(TEST_DIR, 'reporules.ignore'), ignoreContent);

      const result = readIgnoreFile(TEST_DIR);

      expect(result).toEqual(['node_modules', 'dist', '*.log']);
    });

    it('should handle complex gitignore-style patterns', () => {
      const ignoreContent = `
# IDE
.idea/
.vscode/

# Dependencies
node_modules/
vendor/

# Build
dist/
build/
*.dll
*.exe

# Logs
*.log
logs/

# OS
.DS_Store
Thumbs.db
      `.trim();

      writeFileSync(join(TEST_DIR, 'reporules.ignore'), ignoreContent);

      const result = readIgnoreFile(TEST_DIR);

      expect(result).toEqual([
        '.idea/',
        '.vscode/',
        'node_modules/',
        'vendor/',
        'dist/',
        'build/',
        '*.dll',
        '*.exe',
        '*.log',
        'logs/',
        '.DS_Store',
        'Thumbs.db'
      ]);
    });

    it('should handle empty file', () => {
      writeFileSync(join(TEST_DIR, 'reporules.ignore'), '');

      const result = readIgnoreFile(TEST_DIR);

      expect(result).toEqual([]);
    });

    it('should handle file with only comments and empty lines', () => {
      const ignoreContent = `
# Comment 1
# Comment 2

# Comment 3
      `.trim();

      writeFileSync(join(TEST_DIR, 'reporules.ignore'), ignoreContent);

      const result = readIgnoreFile(TEST_DIR);

      expect(result).toEqual([]);
    });

    it('should return empty array and warn on read error', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Create ignore file with no read permissions (Unix only)
      if (process.platform !== 'win32') {
        const ignoreFilePath = join(TEST_DIR, 'reporules.ignore');
        writeFileSync(ignoreFilePath, 'node_modules');
        require('fs').chmodSync(ignoreFilePath, 0o000);

        const result = readIgnoreFile(TEST_DIR);

        expect(result).toEqual([]);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Could not read reporules.ignore file')
        );

        // Restore permissions for cleanup
        require('fs').chmodSync(ignoreFilePath, 0o644);
      }

      warnSpy.mockRestore();
    });

    it('should preserve pattern order', () => {
      const ignoreContent = `
third
first
second
      `.trim();

      writeFileSync(join(TEST_DIR, 'reporules.ignore'), ignoreContent);

      const result = readIgnoreFile(TEST_DIR);

      expect(result).toEqual(['third', 'first', 'second']);
    });

    it('should handle patterns with special characters', () => {
      const ignoreContent = `
**/*.test.js
src/**/temp-*
*.[oa]
!important.o
      `.trim();

      writeFileSync(join(TEST_DIR, 'reporules.ignore'), ignoreContent);

      const result = readIgnoreFile(TEST_DIR);

      expect(result).toEqual([
        '**/*.test.js',
        'src/**/temp-*',
        '*.[oa]',
        '!important.o'
      ]);
    });

    it('should handle inline comments (not treated as comments)', () => {
      // Note: Like .gitignore, we only treat lines starting with # as comments
      const ignoreContent = `
node_modules # This is a dependency
dist # Build output
      `.trim();

      writeFileSync(join(TEST_DIR, 'reporules.ignore'), ignoreContent);

      const result = readIgnoreFile(TEST_DIR);

      // Inline comments are part of the pattern (not stripped)
      expect(result).toEqual([
        'node_modules # This is a dependency',
        'dist # Build output'
      ]);
    });
  });
});
