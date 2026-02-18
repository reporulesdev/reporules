import { LLMClient, LLMProvider } from './types';
import { OpenAIProvider } from './openai';

/**
 * Get LLM client instance based on provider name
 *
 * @param provider - Provider name ('openai', 'anthropic', etc.) or undefined to use env variable
 * @param apiKey - Optional API key (if not provided, reads from environment)
 * @returns LLM client instance
 */
export function getLLMClient(provider?: LLMProvider, apiKey?: string): LLMClient {
  const providerName = provider || (process.env.LLM_PROVIDER as LLMProvider) || 'openai';

  switch (providerName) {
    case 'openai':
      return new OpenAIProvider(apiKey);

    case 'anthropic':
      throw new Error('Anthropic provider not yet implemented. Coming soon!');

    default:
      throw new Error(
        `Unknown LLM provider: "${providerName}". Supported providers: openai, anthropic`
      );
  }
}

/**
 * Check if a provider is supported
 */
export function isProviderSupported(provider: string): provider is LLMProvider {
  return provider === 'openai' || provider === 'anthropic';
}

/**
 * Get list of supported providers
 */
export function getSupportedProviders(): LLMProvider[] {
  return ['openai', 'anthropic'];
}
