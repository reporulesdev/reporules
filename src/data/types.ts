// ============================================================================
// ProjectTree Types
// ============================================================================

/**
 * Flat file information (DB-style, easy to query)
 */
export interface FileInfo {
  path: string;           // Absolute path
  relativePath: string;   // Relative to project root
  name: string;           // File/directory name
  type: 'file' | 'directory';
  depth: number;          // Depth from root (0 = root)
  lines?: number;         // For files only
  parentPath?: string;    // Parent directory path
}

/**
 * Hierarchical node (for LLM consumption)
 */
export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  lines?: number;
  children?: FileNode[];
}

/**
 * Options for ProjectTree scanning
 */
export interface ProjectTreeOptions {
  maxDepth?: number;
  excludeDirs?: string[];
  showFiles?: boolean;
  showLines?: boolean;
}

// ============================================================================
// LLM Analysis Types
// ============================================================================

/**
 * Result from preliminary analysis (Step 1)
 */
export interface PreliminaryAnalysisResult {
  language: string;                // Primary programming language
  buildSystem: string | null;      // Build system (gradle, maven, npm, etc)
  complexity: string;              // Project complexity (low, medium, high)
  architecturePattern: string | null;  // Architecture pattern (hexagonal, layered, mvc, etc)
  structureLevel: string | null;   // Consistency level (strict, partial, none) - only for single pattern
  filesToRead: string[];           // Config files to read for context
}

/**
 * Analysis strategy for rule generation
 */
export interface AnalysisStrategy {
  focusOnGlobalRules: boolean;     // Emphasize global vs layer rules
  emphasizeReferences: boolean;    // Emphasize reference rules
  architecturePattern: string;     // hexagonal, mvc, layered, flat, etc
  persona: string;                 // Persona for downstream tasks
}

/**
 * Layer information
 */
export interface LayerInfo {
  name: string;
  path: string;
  description: string;
  estimatedFiles?: number;
}

/**
 * Result from detailed analysis (Step 2)
 * Returns prefixes to segment the project for rule generation
 */
export interface DetailedAnalysisResult {
  prefixes: string[];  // Directory prefixes to segment project (e.g., ["modules/api/", "modules/service/"])
}

/**
 * Sample file for rule generation
 */
export interface SampleFile {
  path: string;
  content: string;
  lines: number;
}

/**
 * Result from rule generation (Step 3)
 * Contains the generated rule document for a specific prefix
 */
export interface RuleGenerationResult {
  prefix: string;         // The prefix this rule applies to (e.g., "src/api/")
  content: string;        // Generated rule document in markdown format
}

/**
 * Pattern information
 */
export interface PatternInfo {
  name: string;        // 패턴 이름 (예: "Entity", "Repository")
  pattern: string;     // 파일 패턴 (예: "*Entity.java", "*Service.ts")
  count: number;       // 발견된 횟수
  description?: string; // 패턴 설명 (optional)
}

/**
 * Pattern analysis result
 */
export interface PatternAnalysisResult {
  patterns: PatternInfo[];
}
