import { FileNode } from '../../data/types';

/**
 * Render hierarchical tree as string (Unix tree format)
 */
export function renderTree(
  node: FileNode,
  prefix: string = '',
  isRoot: boolean = true,
  maxDepth?: number
): string {
  let output = '';

  if (isRoot) {
    output += `${node.name}\n`;
    if (node.children) {
      node.children.forEach((child, index) => {
        const isLast = index === node.children!.length - 1;
        output += renderTreeNode(child, '', isLast, maxDepth, 1);
      });
    }
    return output;
  }

  return output;
}

function renderTreeNode(
  node: FileNode,
  prefix: string,
  isLast: boolean,
  maxDepth?: number,
  currentDepth: number = 0
): string {
  const connector = isLast ? '└── ' : '├── ';
  let line = `${prefix}${connector}${node.name}`;

  if (node.type === 'directory') {
    line += '/\n';
  } else {
    if (node.lines !== undefined) {
      line += ` (${node.lines} lines)`;
    }
    line += '\n';
  }

  let output = line;

  // Only recurse if we haven't reached max depth
  const shouldRecurse = maxDepth === undefined || currentDepth < maxDepth;

  if (shouldRecurse && node.children && node.children.length > 0) {
    const newPrefix = prefix + (isLast ? '    ' : '│   ');
    node.children.forEach((child, index) => {
      const childIsLast = index === node.children!.length - 1;
      output += renderTreeNode(child, newPrefix, childIsLast, maxDepth, currentDepth + 1);
    });
  }

  return output;
}
