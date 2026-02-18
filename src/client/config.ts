/**
 * LLM Configuration
 *
 * Simple configuration for LLM provider and model selection
 */

export interface LLMConfig {
  provider: 'openai' | 'anthropic';
  model: string;
}

/**
 * Get LLM configuration from environment variables or defaults
 */
export function getLLMConfig(): LLMConfig {
  return {
    provider: (process.env.LLM_PROVIDER as 'openai' | 'anthropic') || 'openai',
    model: process.env.LLM_MODEL || 'gpt-5.1-2025-11-13'
  };
}

/**
 * Default models for each provider
 */
export const DEFAULT_MODELS = {
  openai: 'gpt-5.1-2025-11-13',
  anthropic: 'claude-3-5-sonnet-20241022'  // 준비용
} as const;

/**
 * Validate LLM configuration and API key
 *
 * @throws {Error} if API key is not set for the configured provider
 */
export function validateLLMConfig(): void {
  const config = getLLMConfig();

  // Determine API key environment variable name
  const apiKeyEnvVar = config.provider === 'openai'
    ? 'OPENAI_API_KEY'
    : 'ANTHROPIC_API_KEY';

  const apiKey = process.env[apiKeyEnvVar];

  if (!apiKey) {
    throw new Error(
      `${apiKeyEnvVar} not set. Run "reporules config" for setup instructions.`
    );
  }
}
