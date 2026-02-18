/**
 * LLM Client Abstraction
 *
 * Common interfaces for different LLM providers (OpenAI, Anthropic, etc.)
 */

/**
 * Message format for LLM requests
 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Request parameters for LLM chat completion
 */
export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

/**
 * Response from LLM chat completion
 */
export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Common interface for all LLM providers
 */
export interface LLMClient {
  /**
   * Provider name (e.g., 'openai', 'anthropic')
   */
  name: string;

  /**
   * Send a chat completion request
   */
  chat(request: LLMRequest): Promise<LLMResponse>;
}

/**
 * Supported LLM providers
 */
export type LLMProvider = 'openai' | 'anthropic';
