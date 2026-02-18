import OpenAI from 'openai';
import { LLMClient, LLMRequest, LLMResponse } from './types';

/**
 * Singleton OpenAI client (legacy, for backward compatibility)
 */
class OpenAIClient {
  private static instance: OpenAI | null = null;
  private static apiKey: string | null = null;

  private constructor() {}

  /**
   * Initialize the OpenAI client with API key
   */
  static initialize(apiKey: string): void {
    this.apiKey = apiKey;
    this.instance = new OpenAI({ apiKey });
  }

  /**
   * Get the OpenAI client instance
   * If not initialized, tries to use OPENAI_API_KEY from env
   */
  static getInstance(): OpenAI {
    if (!this.instance) {
      const apiKey = this.apiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error(
          'OpenAI client not initialized. Call OpenAIClient.initialize(apiKey) or set OPENAI_API_KEY environment variable.'
        );
      }
      this.instance = new OpenAI({ apiKey });
    }
    return this.instance;
  }

  /**
   * Reset the client (useful for testing)
   */
  static reset(): void {
    this.instance = null;
    this.apiKey = null;
  }
}

/**
 * OpenAI Provider implementation of LLMClient interface
 */
export class OpenAIProvider implements LLMClient {
  name = 'openai';
  private client: OpenAI;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error(
        'OpenAI API key not provided. Set OPENAI_API_KEY environment variable or pass apiKey to constructor.'
      );
    }
    this.client = new OpenAI({ apiKey: key });
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      temperature: request.temperature ?? 0.1,
      max_tokens: request.maxTokens,
      ...(request.jsonMode && { response_format: { type: 'json_object' } })
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    return {
      content,
      model: response.model,
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens
      } : undefined
    };
  }
}

export default OpenAIClient;
