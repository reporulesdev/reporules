/**
 * Type definitions for analyzeProject use case
 */

import { ProjectTree } from '../../support/projectTree';
import { PreliminaryAnalysisResult } from '../../data/types';

/**
 * Options for project analysis
 */
export interface AnalyzeOptions {
  projectPath: string;
  outputDir: string;
  experimental?: boolean;
  includeSmall?: boolean;  // Analyze small flat modules (1-10 files) for potential rules
}

/**
 * Result of batch segment processing
 */
export interface BatchResult {
  prefix: string;
  status: 'success' | 'skipped' | 'failed';
  reason?: string;
  type?: 'template-based' | 'decomposed' | 'small-segment';
  lines?: number;
  filename?: string;
  chars?: number;
  content?: string;  // in-memory rule content (to avoid re-reading from disk)
}

/**
 * Analysis context shared across steps
 */
export interface AnalysisContext {
  projectPath: string;
  actualProjectPath: string;
  outputDir: string;
  tree: ProjectTree;
  prelimResult: PreliminaryAnalysisResult;
  experimental: boolean;
}

/**
 * Rule file metadata + in-memory content
 */
export interface RuleFile {
  prefix: string;
  filename: string;
  content: string;
}
