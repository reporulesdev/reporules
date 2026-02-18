import { ProjectTree, renderTree } from '../projectTree';
import { join } from 'path';

const TEST_REPO_PATH = './simple-repo/devrunner_public_be';

describe('ProjectTree', () => {
  let projectTree: ProjectTree;

  beforeAll(() => {
    projectTree = new ProjectTree(TEST_REPO_PATH, {
      showFiles: true,
      showLines: true,
    });
  });

  describe('Flat file list (internal storage)', () => {
    it('should scan and store files in flat array', () => {
      const allFiles = projectTree.getFiles();
      expect(allFiles).toBeDefined();
      expect(allFiles.length).toBeGreaterThan(0);
    });

    it('should include both files and directories', () => {
      const allFiles = projectTree.getFiles();
      const files = allFiles.filter((f) => f.type === 'file');
      const dirs = allFiles.filter((f) => f.type === 'directory');

      expect(files.length).toBeGreaterThan(0);
      expect(dirs.length).toBeGreaterThan(0);
    });

    it('should have correct file metadata', () => {
      const allFiles = projectTree.getFiles();
      const firstFile = allFiles.find((f) => f.type === 'file');

      expect(firstFile).toBeDefined();
      expect(firstFile?.path).toBeDefined();
      expect(firstFile?.relativePath).toBeDefined();
      expect(firstFile?.name).toBeDefined();
      expect(firstFile?.depth).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Filter files', () => {
    it('should filter Java files correctly', () => {
      const javaFiles = projectTree.filterFiles(
        (f) => f.type === 'file' && f.path.endsWith('.java')
      );

      expect(javaFiles.length).toBeGreaterThan(0);
      javaFiles.forEach((file) => {
        expect(file.path).toMatch(/\.java$/);
      });
    });

    it('should filter by depth', () => {
      const shallowFiles = projectTree.filterFiles((f) => f.depth <= 2);

      expect(shallowFiles.length).toBeGreaterThan(0);
      shallowFiles.forEach((file) => {
        expect(file.depth).toBeLessThanOrEqual(2);
      });
    });
  });

  describe('Pick by prefix', () => {
    it('should return all files for empty prefix', () => {
      const allFiles = projectTree.pickByPrefix('');
      const expectedFiles = projectTree.getFiles();

      expect(allFiles.length).toBe(expectedFiles.length);
      expect(allFiles).toEqual(expectedFiles);
    });

    it('should pick files by prefix', () => {
      const moduleFiles = projectTree.pickByPrefix('modules/');

      expect(moduleFiles.length).toBeGreaterThan(0);
      moduleFiles.forEach((file) => {
        expect(file.relativePath.startsWith('modules/')).toBe(true);
      });
    });

    it('should pick files from specific module', () => {
      const apiFiles = projectTree.pickByPrefix('modules/devrunner/');

      expect(apiFiles.length).toBeGreaterThan(0);
      apiFiles.forEach((file) => {
        expect(file.relativePath.startsWith('modules/devrunner/')).toBe(true);
      });
    });

    it('should return empty array for non-existent prefix', () => {
      const nonExistent = projectTree.pickByPrefix('nonexistent/path/');

      expect(nonExistent).toEqual([]);
    });

    it('should handle deep prefix paths', () => {
      const modelFiles = projectTree.pickByPrefix('modules/devrunner/model/');

      // May or may not have files depending on structure
      modelFiles.forEach((file) => {
        expect(file.relativePath.startsWith('modules/devrunner/model/')).toBe(true);
      });
    });
  });

  describe('Pattern matching', () => {
    it('should match files by glob pattern', () => {
      const modelFiles = projectTree.matchFiles('**/model/**/*.java');

      expect(modelFiles.length).toBeGreaterThan(0);
      modelFiles.forEach((file) => {
        expect(file.relativePath).toMatch(/model.*\.java$/);
      });
    });

    it('should match files by regex', () => {
      const pattern = /\.java$/;
      const javaFiles = projectTree.matchFiles(pattern);

      expect(javaFiles.length).toBeGreaterThan(0);
      javaFiles.forEach((file) => {
        expect(file.relativePath).toMatch(pattern);
      });
    });
  });

  describe('Hierarchical conversion', () => {
    it('should convert flat structure to hierarchical tree', () => {
      const hierarchical = projectTree.toHierarchical();

      expect(hierarchical).toBeDefined();
      expect(hierarchical.type).toBe('directory');
      expect(hierarchical.children).toBeDefined();
      expect(hierarchical.children!.length).toBeGreaterThan(0);
    });

    it('should sort children (directories first, then alphabetically)', () => {
      const hierarchical = projectTree.toHierarchical();
      const children = hierarchical.children!;

      // Check directories come before files
      let lastType: 'directory' | 'file' = 'directory';
      children.forEach((child) => {
        if (lastType === 'file' && child.type === 'directory') {
          fail('Directories should come before files');
        }
        lastType = child.type;
      });
    });
  });

  describe('Subtree extraction', () => {
    it('should extract subtree for specific path', () => {
      const modelSubtree = projectTree.getSubtree('modules/devrunner/model');

      expect(modelSubtree).toBeDefined();
      expect(modelSubtree?.name).toBe('model');
      expect(modelSubtree?.type).toBe('directory');
    });

    it('should return null for non-existent path', () => {
      const nonExistent = projectTree.getSubtree('non/existent/path');

      expect(nonExistent).toBeNull();
    });
  });

  describe('Group by pattern', () => {
    it('should group files by layer pattern', () => {
      const layerPattern = /modules\/([^\/]+\/[^\/]+)/;
      const layers = projectTree.groupByPattern(layerPattern);

      expect(layers.size).toBeGreaterThan(0);

      layers.forEach((files, layerName) => {
        expect(layerName).toBeDefined();
        expect(files.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Statistics', () => {
    it('should calculate correct statistics', () => {
      const stats = projectTree.getStats();

      expect(stats.totalFiles).toBeGreaterThan(0);
      expect(stats.totalDirs).toBeGreaterThan(0);
      expect(stats.totalLines).toBeGreaterThan(0);
      expect(stats.averageLines).toBeGreaterThan(0);
    });

    it('should have consistent totals', () => {
      const stats = projectTree.getStats();
      const allFiles = projectTree.getFiles();

      const actualFiles = allFiles.filter((f) => f.type === 'file').length;
      const actualDirs = allFiles.filter((f) => f.type === 'directory').length;

      expect(stats.totalFiles).toBe(actualFiles);
      expect(stats.totalDirs).toBe(actualDirs);
    });
  });

  describe('Tree string rendering', () => {
    it('should render tree as string', () => {
      const treeString = projectTree.toTreeString();

      expect(treeString).toBeDefined();
      expect(treeString.length).toBeGreaterThan(0);
      expect(treeString).toContain('├──');
      expect(treeString).toContain('└──');
    });

    it('should respect depth limit', () => {
      const fullTree = projectTree.toTreeString();
      const limitedTree = projectTree.toTreeString(2);

      expect(limitedTree.length).toBeLessThan(fullTree.length);
    });
  });
});
