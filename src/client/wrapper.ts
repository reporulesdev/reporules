import { getLLMClient } from './factory';
import { getLLMConfig } from './config';

/**
 * Simplified LLM call wrapper
 *
 * Provides a cleaner API for LLM calls with automatic provider/model selection
 */
export async function callLLM(params: {
  systemPrompt: string;
  userPrompt: string;
  model?: string;          // Override config model
  temperature?: number;
  jsonMode?: boolean;
  debug?: boolean;
}): Promise<string> {
  const config = getLLMConfig();
  const client = getLLMClient(config.provider);

  // Use provided model or config model
  const model = params.model || config.model;

  if (params.debug) {
    console.log(`🤖 LLM Call: ${config.provider} / ${model}`);
  }

  const response = await client.chat({
    model,
    messages: [
      { role: 'system', content: params.systemPrompt },
      { role: 'user', content: params.userPrompt }
    ],
    temperature: params.temperature ?? 0.1,
    jsonMode: params.jsonMode
  });

  return response.content;
}
