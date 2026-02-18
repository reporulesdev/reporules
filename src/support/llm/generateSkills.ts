import { callLLM } from '../../client/wrapper';
import { RuleFile } from '../../usecase/analyze/types';

/**
 * A generated skill entry
 */
export interface SkillEntry {
  title: string;   // slug (e.g. "add-user-endpoint")
  content: string; // full markdown body
}

/**
 * Generate skills from rules content + project tree
 *
 * Asks LLM to derive 1–3 actionable workflow skills
 * based on the patterns found in the generated rule files.
 */
export async function generateSkills(
  treeString: string,
  ruleFiles: RuleFile[],
  projectName: string,
  model: string = 'gpt-5.1-2025-11-13',
  debug: boolean = false
): Promise<SkillEntry[]> {
  if (ruleFiles.length === 0) {
    return [];
  }

  const systemPrompt = buildSkillsSystemPrompt();
  const userPrompt = buildSkillsUserPrompt(treeString, ruleFiles, projectName);

  if (debug) {
    console.log('\n' + '='.repeat(80));
    console.log('🛠️  GENERATE SKILLS');
    console.log('='.repeat(80));
    console.log('SYSTEM:\n', systemPrompt.substring(0, 500) + '...');
    console.log('\nUSER:\n', userPrompt.substring(0, 500) + '...');
    console.log('='.repeat(80) + '\n');
  }

  const response = await callLLM({
    systemPrompt,
    userPrompt,
    model,
    temperature: 0.3,
    debug,
  });

  return parseSkillsResponse(response, debug);
}

// ──────────────────────────────────────────────
// Prompt builders
// ──────────────────────────────────────────────

function buildSkillsSystemPrompt(): string {
  return `You are creating step-by-step developer skill guides for a codebase.

Each skill is a concise, actionable workflow document that guides a developer through a common "add X" task in this specific project.

## Output Format

Output one or more skill files separated by delimiters:

=== add-{name}.md ===
{file content}

=== add-{name2}.md ===
{file content}

## Per-file Format (≤100 lines each)

- Title: \`# skill: {task name}\`
- Brief one-line description of what this skill covers
- Steps ordered by dependency (bottom layer first)
- Each step:
  - Heading: \`### Step N. {LayerName} — {filename}\`
  - Code snippet taken directly from the rules (do not invent)
  - One-line explanation of what and why
- Final checklist: \`- [ ]\` items for each step

## Constraints

- Only use code patterns that appear in the provided rules
- Do not add imports, fields, or logic not shown in the rules
- Each file must be ≤100 lines
- If a task would exceed 100 lines, trim code snippets (keep structure, shorten body)
- Generate up to 7 skill files; if more tasks exist, pick the 7 most important
- Output only the skill files with their delimiters — no extra explanation`;
}

function buildSkillsUserPrompt(
  treeString: string,
  ruleFiles: RuleFile[],
  projectName: string
): string {
  // Filter out global.md
  const filteredRules = ruleFiles.filter(r => r.filename !== 'global.md');

  const rulesSection = filteredRules
    .map(r => `=== ${r.filename} ===\n${r.content}`)
    .join('\n\n');

  return `## Project: ${projectName}

## Directory Tree
${treeString}

## Rules
${rulesSection}

---

## Task

Based on the rules and tree above:

1. Identify all meaningful "add X" tasks a developer would commonly perform
   (e.g. "add a new domain", "add an endpoint", "add middleware")
   - Choose based on the architecture pattern visible in the rules
   - Prefer tasks that touch multiple layers end-to-end

2. If more than 7 tasks are identified, select the 7 most important ones:
   - Prioritize tasks that are most frequently needed
   - Prioritize tasks that span the most layers (higher learning value)
   - Deprioritize tasks that are trivial or highly similar to another selected task

3. For each selected task (up to 7), write a \`skills/add-{name}.md\` file following the output format in your instructions.`;
}

// ──────────────────────────────────────────────
// Response parser
// ──────────────────────────────────────────────

/**
 * Parse delimiter-based response:
 *
 * === add-domain.md ===
 * {content}
 *
 * === add-endpoint.md ===
 * {content}
 */
function parseSkillsResponse(response: string, debug: boolean): SkillEntry[] {
  const skills: SkillEntry[] = [];

  // Split on delimiter pattern: === {filename} ===
  const parts = response.split(/^=== (.+?) ===/m);

  // parts layout after split: ['preamble', 'filename1', 'content1', 'filename2', 'content2', ...]
  for (let i = 1; i < parts.length - 1; i += 2) {
    const rawFilename = parts[i].trim();
    const content = parts[i + 1].trim();

    if (!rawFilename || !content) continue;

    // Extract slug from filename (e.g. "add-domain.md" → "add-domain")
    const title = rawFilename.replace(/\.md$/, '');

    skills.push({ title, content });
  }

  // Safety cap: enforce max 7 even if LLM outputs more
  const capped = skills.slice(0, 7);

  if (debug) {
    console.log(`✓ Generated ${capped.length} skills: ${capped.map(s => s.title).join(', ')}`);
  }

  return capped;
}
