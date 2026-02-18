import { readdirSync, statSync, readFileSync } from 'fs';
import { join, relative, dirname, basename, isAbsolute, resolve } from 'path';
import { readIgnoreFile } from './ignoreReader';
import { DEFAULT_EXCLUDE } from '../../data/constants';
import { FileInfo, FileNode, ProjectTreeOptions } from '../../data/types';
import { renderTree } from './treeRenderer';

/**
 * ProjectTree
 *
 * A hybrid data structure for managing project file trees.
 *
 * ## Design Philosophy
 * - **Internal Storage**: Flat array (FileInfo[]) for efficient querying and manipulation
 * - **External Output**: Hierarchical tree (FileNode) for LLM consumption and visualization
 *
 * ## Key Features
 * - Recursive directory scanning with configurable depth limits
 * - Automatic exclusion of common build/dependency directories (node_modules, dist, etc.)
 * - Support for custom ignore patterns via reporules.ignore file
 * - Multiple query methods: prefix-based, pattern matching, filtering
 * - Efficient flat-to-tree conversion using Map-based lookup
 * - Optional line counting for files
 *
 * ## Usage
 * ```typescript
 * const tree = new ProjectTree('./my-project', {
 *   maxDepth: 5,
 *   showLines: true,
 *   excludeDirs: ['custom-ignore']
 * });
 *
 * // Query files
 * const apiFiles = tree.pickByPrefix('src/api/');
 * const javaFiles = tree.matchFiles('**\/*.java');
 *
 * // Convert to hierarchy
 * const hierarchical = tree.toHierarchical();
 * const treeString = tree.toTreeString();
 * ```
 *
 * @class ProjectTree
 */
export class ProjectTree {
  private files: FileInfo[];
  private rootPath: string;
  private options: Required<ProjectTreeOptions>;

  constructor(dirPath: string, options: ProjectTreeOptions = {}) {
    // Handle both absolute and relative paths correctly
    this.rootPath = isAbsolute(dirPath) ? dirPath : resolve(process.cwd(), dirPath);

    // Read custom ignore patterns from reporules.ignore
    const customIgnores = readIgnoreFile(this.rootPath);

    // Merge default excludes with custom ignores
    const mergedExcludes = options.excludeDirs
      ? options.excludeDirs
      : [...DEFAULT_EXCLUDE, ...customIgnores];

    this.options = {
      maxDepth: options.maxDepth ?? Infinity,
      excludeDirs: mergedExcludes,
      showFiles: options.showFiles ?? true,
      showLines: options.showLines ?? false,
    };

    // Scan and build flat structure
    this.files = this.scanDirectory(this.rootPath, 0);
  }

  /**
   * Scan directory and build flat file list
   */
  private scanDirectory(dirPath: string, currentDepth: number): FileInfo[] {
    const files: FileInfo[] = [];

    if (currentDepth >= this.options.maxDepth) {
      return files;
    }

    let entries: string[];
    try {
      entries = readdirSync(dirPath);
    } catch (err) {
      return files;
    }

    // Filter excluded directories
    entries = entries.filter((entry) => !this.options.excludeDirs.includes(entry));

    // Process each entry
    entries.forEach((entry) => {
      const fullPath = join(dirPath, entry);
      let stat;

      try {
        stat = statSync(fullPath);
      } catch (err) {
        return; // Skip if can't stat
      }

      const isDirectory = stat.isDirectory();
      const relPath = relative(this.rootPath, fullPath);

      // Create FileInfo
      const fileInfo: FileInfo = {
        path: fullPath,
        relativePath: relPath,
        name: entry,
        type: isDirectory ? 'directory' : 'file',
        depth: currentDepth,
        parentPath: dirPath,
      };

      // Add line count for files if requested
      if (!isDirectory && this.options.showLines) {
        try {
          const content = readFileSync(fullPath, 'utf-8');
          fileInfo.lines = content.split('\n').length;
        } catch (err) {
          // Skip line count on error
        }
      }

      // Add to list if:
      // - It's a directory, OR
      // - It's a file AND showFiles is true
      if (isDirectory || this.options.showFiles) {
        files.push(fileInfo);
      }

      // Recurse into directories
      if (isDirectory) {
        const children = this.scanDirectory(fullPath, currentDepth + 1);
        files.push(...children);
      }
    });

    return files;
  }

  /**
   * Get flat file list (for internal manipulation)
   */
  getFiles(): FileInfo[] {
    return this.files;
  }

  /**
   * Pick files by prefix (for segmentation)
   * @param prefix - Directory prefix (e.g., "modules/api/", "src/services/")
   * @returns Files that start with the given prefix. Empty string returns all files.
   */
  pickByPrefix(prefix: string): FileInfo[] {
    if (prefix === '') {
      return this.files; // Global: return all files
    }

    return this.files.filter((f) => f.relativePath.startsWith(prefix));
  }

  /**
   * Filter files by predicate
   */
  filterFiles(predicate: (file: FileInfo) => boolean): FileInfo[] {
    return this.files.filter(predicate);
  }

  /**
   * Get all files matching a glob-like pattern (simple implementation)
   */
  matchFiles(pattern: string | RegExp): FileInfo[] {
    if (typeof pattern === 'string') {
      // Simple glob: "*.java" or "**/*.java"
      const regex = new RegExp(
        pattern
          .replace(/\./g, '\\.')
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*') + '$'
      );
      return this.files.filter((f) => regex.test(f.relativePath));
    } else {
      return this.files.filter((f) => pattern.test(f.relativePath));
    }
  }

  /**
   * Convert flat structure to hierarchical (for LLM)
   */
  toHierarchical(): FileNode {
    // Build a map for quick lookup
    const map = new Map<string, FileNode>();

    // Create root node
    const root: FileNode = {
      name: basename(this.rootPath),
      path: this.rootPath,
      type: 'directory',
      children: [],
    };
    map.set(this.rootPath, root);

    // Sort files by path to ensure parents are processed before children
    const sortedFiles = [...this.files].sort((a, b) => a.path.localeCompare(b.path));

    // Build tree
    sortedFiles.forEach((file) => {
      const node: FileNode = {
        name: file.name,
        path: file.path,
        type: file.type,
        lines: file.lines,
      };

      if (file.type === 'directory') {
        node.children = [];
      }

      map.set(file.path, node);

      // Find parent and add to its children
      const parentPath = file.parentPath || dirname(file.path);
      const parent = map.get(parentPath);

      if (parent && parent.children) {
        parent.children.push(node);
      }
    });

    // Sort children alphabetically (directories first, then files)
    const sortChildren = (node: FileNode) => {
      if (node.children) {
        node.children.sort((a, b) => {
          // Directories first
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
          }
          // Then alphabetically
          return a.name.localeCompare(b.name);
        });

        // Recurse
        node.children.forEach(sortChildren);
      }
    };

    sortChildren(root);
    return root;
  }

  /**
   * Get subtree for a specific path
   */
  getSubtree(targetPath: string): FileNode | null {
    // Normalize path
    const fullTargetPath = join(this.rootPath, targetPath);

    // Find all files under this path
    const subFiles = this.files.filter((f) => {
      return f.path === fullTargetPath || f.path.startsWith(fullTargetPath + '/');
    });

    if (subFiles.length === 0) {
      return null;
    }

    // Build hierarchical structure for this subtree
    const map = new Map<string, FileNode>();

    // Find the target node itself
    const targetFile = this.files.find((f) => f.path === fullTargetPath);
    if (!targetFile) {
      return null;
    }

    const root: FileNode = {
      name: targetFile.name,
      path: targetFile.path,
      type: targetFile.type,
      lines: targetFile.lines,
      children: targetFile.type === 'directory' ? [] : undefined,
    };
    map.set(targetFile.path, root);

    // Sort and build
    const sortedFiles = subFiles
      .filter((f) => f.path !== fullTargetPath) // Exclude root itself
      .sort((a, b) => a.path.localeCompare(b.path));

    sortedFiles.forEach((file) => {
      const node: FileNode = {
        name: file.name,
        path: file.path,
        type: file.type,
        lines: file.lines,
      };

      if (file.type === 'directory') {
        node.children = [];
      }

      map.set(file.path, node);

      // Find parent
      const parentPath = file.parentPath || dirname(file.path);
      const parent = map.get(parentPath);

      if (parent && parent.children) {
        parent.children.push(node);
      }
    });

    // Sort children
    const sortChildren = (node: FileNode) => {
      if (node.children) {
        node.children.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
        node.children.forEach(sortChildren);
      }
    };

    sortChildren(root);
    return root;
  }

  /**
   * Group files by a path pattern (for layer detection)
   */
  groupByPattern(pattern: RegExp): Map<string, FileInfo[]> {
    const groups = new Map<string, FileInfo[]>();

    this.files.forEach((file) => {
      const match = file.relativePath.match(pattern);
      if (match && match[1]) {
        const key = match[1];
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(file);
      }
    });

    return groups;
  }

  /**
   * Get statistics
   */
  getStats() {
    const totalFiles = this.files.filter((f) => f.type === 'file').length;
    const totalDirs = this.files.filter((f) => f.type === 'directory').length;
    const totalLines = this.files.reduce((sum, f) => sum + (f.lines || 0), 0);

    return {
      totalFiles,
      totalDirs,
      totalLines,
      averageLines: totalFiles > 0 ? Math.round(totalLines / totalFiles) : 0,
    };
  }

  /**
   * Convert to tree string for LLM consumption
   * @param maxDepth - Optional max depth to render (for token efficiency)
   */
  toTreeString(maxDepth?: number): string {
    const hierarchical = this.toHierarchical();
    return renderTree(hierarchical, '', true, maxDepth);
  }
}
