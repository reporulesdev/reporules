/**
 * Constants for project analysis
 */

/**
 * Analysis configuration
 */
export const ANALYSIS_CONFIG = {
  /**
   * Number of segments to process in parallel
   */
  BATCH_SIZE: 10,

  /**
   * Default LLM model for analysis
   * Can be overridden by LLM_MODEL environment variable
   */
  DEFAULT_MODEL: 'gpt-5.1-2025-11-13',

  /**
   * Maximum lines per sample file
   */
  SAMPLE_MAX_LINES: 300,

  /**
   * Maximum lines for sample file selection
   */
  SELECTION_MAX_LINES: 1500,

  /**
   * Maximum depth for initial project detection
   */
  INITIAL_TREE_DEPTH: 5,
} as const;
