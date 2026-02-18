import { callLLM } from '../../client/wrapper';
import { PreliminaryAnalysisResult } from '../../data/types';
import { deduplicateFilePatterns } from '../patternDeduplicator';

/**
 * Step 1: Preliminary Analysis
 *
 * Identifies:
 * - Config files to read (build.gradle, package.json, etc)
 * - Primary language
 * - Architecture hint
 */
export async function preliminaryAnalysis(
  tree: string,
  model?: string
): Promise<PreliminaryAnalysisResult> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(tree);

  const content = await callLLM({
    systemPrompt,
    userPrompt,
    model,
    temperature: 0.1,
    jsonMode: true
  });

  const rawResult = JSON.parse(content) as PreliminaryAnalysisResult;

  // Apply pattern deduplication to reduce redundant files
  const deduplicatedFiles = deduplicateFilePatterns(rawResult.filesToRead);

  return {
    ...rawResult,
    filesToRead: deduplicatedFiles,
  };
}

/**
 * Build system prompt (instructions)
 */
function buildSystemPrompt(): string {
  return `You are an expert at identifying project structure and build systems. Respond with JSON only.

<goal>
You are a tool for analyzing GitHub projects. Your mission is to extract project attributes and characteristics that can be identified from the tree structure.

The items you need to extract are: language, buildSystem, complexity, architecturePattern, structureLevel, filesToRead.

For each item, execute the rules specified in the task rules below. It is recommended to perform the rules in order.
</goal>

=== Task Rules ===

<language>
Rule: Identify the primary programming language based on file extensions in the project tree.
- Find the most frequently appearing file extension
- Examples: .java → "java", .ts/.tsx → "typescript", .py → "python", .go → "go"
Output: string (e.g., "java", "typescript", "python")
</language>

<buildSystem>
Rule: Identify the build system by checking for build files in root or top-level directories.
- Java: build.gradle.kts, pom.xml → "gradle" or "maven"
- Node.js: package.json → "npm" (or yarn, pnpm)
- Python: setup.py, pyproject.toml → "setuptools", "poetry"
- If not found → null
Output: string or null (e.g., "gradle", "maven", "npm", null)
</buildSystem>

<complexity>
Rule: Judge project complexity from an expert's perspective for production-level systems.
- high: Large-scale production, many modules/layers, complex dependencies
- medium: Typical production project OR **default when uncertain**
- low: Small project, simple structure
- You may provide detailed descriptions (e.g., "medium (50+ modules)")
Output: string (e.g., "low", "medium", "high", "medium (50+ modules)")
</complexity>

<architecturePattern>
Rule: Identify architecture patterns from folder structure and module names.
- Common patterns: "hexagonal", "layered", "mvc", "flat", "port-adapter", "modular"
- If no clear pattern → "flat" or "unclear"
- **If multiple patterns coexist** → List them separated by commas (e.g., "hexagonal, layered")
Output: string (e.g., "hexagonal", "layered, mvc", "unclear")
</architecturePattern>

<structureLevel>
Rule: Evaluate consistency level ONLY when architecturePattern is a **single** pattern.
- Prerequisite: architecturePattern must be clearly identified as ONE pattern
- If multiple patterns (comma-separated) → null
- If single pattern identified, evaluate consistency:
  - strict: 70%+ consistency
  - partial: 20-50% consistency
  - none: below 20% consistency
- You may provide detailed descriptions (e.g., "strict (85%)")
Output: string or null (e.g., "strict (80%)", "partial (35%)", "none", null)
</structureLevel>

<filesToRead>
Rule: List essential configuration/build files needed to understand project structure.

**Steps:**
1. Identify if this project is divided into structural units such as modules, deployment units, or multi-modules (like Spring's multi-module level)
2. If so, list the configuration files that represent each unit (e.g., build.gradle.kts, package.json)

**Priority:**
1. Root-level build files (package.json, build.gradle.kts, settings.gradle.kts)
2. Workspace configuration (pnpm-workspace.yaml, lerna.json)
3. Configuration files for each structural unit (following the rules above)

**Guidelines:**
- Verify files actually exist in the tree
- Include all necessary files to understand the structure

Output: string array (e.g., ["build.gradle.kts", "settings.gradle.kts", "modules/api/build.gradle.kts", "modules/core/build.gradle.kts"])
</filesToRead>

=== Output Format ===
Return JSON only:
{
  "language": string,
  "buildSystem": string | null,
  "complexity": string,
  "architecturePattern": string | null,
  "structureLevel": string | null,
  "filesToRead": string[]
}

=== General Principles ===
- When uncertain, be conservative (complexity → "medium", structureLevel → null)
- Free-form descriptions are allowed (e.g., "medium (30 modules)", "strict (85% consistent)")
- If multiple interpretations exist, choose the most dominant pattern
`;
}

/**
 * Build user prompt (data only)
 */
function buildUserPrompt(tree: string): string {
  return `=== Project Tree ===
${tree}`;
}
