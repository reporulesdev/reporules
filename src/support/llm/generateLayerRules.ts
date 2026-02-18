import { callLLM } from '../../client/wrapper';
import { AnalysisStrategy, SampleFile } from '../../data/types';

/**
 * Generate rules for a layer with strategy
 */
export async function generateLayerRules(
  layerName: string,
  sampleFiles: SampleFile[],
  strategy: AnalysisStrategy,
  model: string = 'gpt-5.1-2025-11-13'
): Promise<string> {
  const systemPrompt = buildSystemPrompt(strategy);
  const userPrompt = buildUserPrompt(layerName, sampleFiles, strategy);

  const content = await callLLM({
    systemPrompt,
    userPrompt,
    model,
    temperature: 0.2
  });

  return content;
}

/**
 * Build system prompt (instructions)
 */
function buildSystemPrompt(strategy: AnalysisStrategy): string {
  return `${strategy.persona}

<goal>
Generate coding rules for a specific layer based on sample files.
</goal>

<task>
Analyze the provided sample files and generate patterns and rules.

Include:
1. Naming conventions
2. Annotations/decorators
3. Class/file structure
4. Dependencies
${strategy.emphasizeReferences ? '5. **Reference rules** (how this layer references others)\n' : ''}
</task>

<output-format>
Format as Claude Code rules markdown document:

---
paths:
  - "path/pattern"
---

# [Layer Name] Rules

## Naming Conventions
...

## Required Annotations
...

${strategy.emphasizeReferences ? `## Reference Rules
How this layer interacts with other layers.
...

` : ''}## Code Examples

✅ Good:
\`\`\`
...
\`\`\`

❌ Bad:
\`\`\`
...
\`\`\`
</output-format>

Generate the rules document based on the provided data.`;
}

/**
 * Build user prompt (data only)
 */
function buildUserPrompt(
  layerName: string,
  sampleFiles: SampleFile[],
  strategy: AnalysisStrategy
): string {
  let prompt = `<layer-name>${layerName}</layer-name>\n\n`;

  // Add strategy context
  prompt += '<analysis-strategy>\n';
  prompt += `Architecture: ${strategy.architecturePattern}\n`;
  if (strategy.focusOnGlobalRules) {
    prompt += 'Focus: Global conventions (this layer may not have strong patterns)\n';
  }
  if (strategy.emphasizeReferences) {
    prompt += 'Emphasis: Reference rules (how this layer interacts with others)\n';
  }
  prompt += '</analysis-strategy>\n\n';

  // Add sample files
  prompt += '<sample-files>\n';
  sampleFiles.forEach((file, index) => {
    prompt += `--- ${file.path} (${file.lines} lines) ---\n`;
    prompt += file.content + '\n\n';
  });
  prompt += '</sample-files>';

  return prompt;
}
