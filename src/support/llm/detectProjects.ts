import { callLLM } from '../../client/wrapper';

export interface ProjectCandidate {
  path: string;
  name: string;
  description: string;
  estimatedFileCount?: number;
  warning?: string;
}

export interface ProjectDetectionResult {
  projects: ProjectCandidate[];
  isSingleProject: boolean;
  reasoning?: string;
}

const SYSTEM_PROMPT = `You are a project structure analyzer. Your task is to identify separate projects within a directory tree.

## Guidelines:

**Criterion 1: Monorepo/Multi-module = Single Project**
- If multiple modules/packages share the same build system and are part of one cohesive project, treat it as ONE project
- Examples:
  - npm/pnpm workspace with multiple apps/packages
  - Gradle multi-module project with settings.gradle
  - Maven multi-module project with parent pom.xml
  - Go project with multiple packages under one go.mod

**Criterion 2: Different Tech Stacks = Separate Projects**
- If frontend and backend use different languages/build systems, treat them as SEPARATE projects
- If multiple independent projects coexist in one directory, list them separately
- Examples:
  - frontend/ (npm) + backend/ (gradle) = 2 projects
  - web/ (React) + api/ (Spring Boot) + ml-service/ (Python) = 3 projects

**Criterion 3: Ambiguous Cases**
- When unsure, prefer grouping as ONE project (conservative approach)
- Provide a warning in the output if the structure is complex or ambiguous

## Output Format:

Return a valid JSON object:

\`\`\`json
{
  "projects": [
    {
      "path": "frontend/",
      "name": "frontend",
      "description": "React web application with TypeScript",
      "estimatedFileCount": 340,
      "warning": "Optional warning message if complex"
    }
  ],
  "isSingleProject": true,
  "reasoning": "Brief explanation of your decision"
}
\`\`\`

## Examples:

**Example 1: npm workspace (monorepo)**
Input tree:
\`\`\`
my-project/
├── package.json
├── pnpm-workspace.yaml
├── apps/
│   ├── web/
│   │   └── package.json
│   └── api/
│       └── package.json
└── packages/
    └── ui/
        └── package.json
\`\`\`

Output:
\`\`\`json
{
  "projects": [
    {
      "path": ".",
      "name": "my-project",
      "description": "npm workspace monorepo with web and api apps"
    }
  ],
  "isSingleProject": true,
  "reasoning": "Single monorepo managed by pnpm workspace"
}
\`\`\`

**Example 2: Separate frontend/backend**
Input tree:
\`\`\`
workspace/
├── frontend/
│   ├── package.json
│   └── src/
└── backend/
    ├── build.gradle.kts
    └── src/
\`\`\`

Output:
\`\`\`json
{
  "projects": [
    {
      "path": "frontend/",
      "name": "frontend",
      "description": "npm-based frontend application"
    },
    {
      "path": "backend/",
      "name": "backend",
      "description": "Gradle-based backend service"
    }
  ],
  "isSingleProject": false,
  "reasoning": "Two separate projects with different tech stacks (npm + Gradle)"
}
\`\`\`

**Example 3: Gradle multi-module**
Input tree:
\`\`\`
backend/
├── settings.gradle.kts
├── build.gradle.kts
├── auth/
│   └── build.gradle.kts
├── service/
│   └── build.gradle.kts
└── infrastructure/
    └── build.gradle.kts
\`\`\`

Output:
\`\`\`json
{
  "projects": [
    {
      "path": ".",
      "name": "backend",
      "description": "Gradle multi-module project"
    }
  ],
  "isSingleProject": true,
  "reasoning": "Single Gradle project with multiple modules defined in settings.gradle.kts"
}
\`\`\`

**Example 4: Complex monorepo**
Input tree:
\`\`\`
huge-project/
├── platform-android/
├── platform-ios/
├── platform-web/
├── backend/
├── shared/
├── (47 more top-level directories)
\`\`\`

Output:
\`\`\`json
{
  "projects": [
    {
      "path": ".",
      "name": "huge-project",
      "description": "Large multi-platform monorepo",
      "warning": "Very complex structure with 51+ top-level directories"
    }
  ],
  "isSingleProject": true,
  "reasoning": "Appears to be a single large monorepo, though complexity is very high"
}
\`\`\`

Now analyze the following directory tree and identify projects.`;

const USER_PROMPT_TEMPLATE = `Analyze this directory tree (depth 4):

\`\`\`
{{TREE}}
\`\`\`

Identify separate projects according to the guidelines. Return valid JSON only.`;

/**
 * Detect projects in a directory tree using LLM
 */
export async function detectProjects(
  treeString: string,
  model: string = 'gpt-5.1-2025-11-13',
  debug: boolean = false
): Promise<ProjectDetectionResult> {
  const userPrompt = USER_PROMPT_TEMPLATE.replace('{{TREE}}', treeString);

  if (debug) {
    console.log('=== Project Detection Prompt ===');
    console.log(userPrompt);
    console.log('================================\n');
  }

  // Retry up to 3 times
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const content = await callLLM({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        model,
        temperature: 0.1,
        jsonMode: true,
        debug
      });

      if (debug) {
        console.log('=== LLM Response ===');
        console.log(content);
        console.log('====================\n');
      }

      // Parse JSON
      const result = JSON.parse(content) as ProjectDetectionResult;

      // Validate
      if (!result.projects || !Array.isArray(result.projects)) {
        throw new Error('Invalid response format: missing projects array');
      }

      if (result.isSingleProject === undefined) {
        throw new Error('Invalid response format: missing isSingleProject flag');
      }

      return result;
    } catch (error: any) {
      console.warn(`⚠️  Project detection attempt ${attempt}/3 failed: ${error.message}`);

      if (attempt === 3) {
        // Final failure: return default (treat as single project)
        console.error('❌ Project detection failed after 3 attempts. Treating as single project.');
        return {
          projects: [
            {
              path: '.',
              name: 'unknown-project',
              description: 'Could not detect project structure',
              warning: 'Project detection failed. Proceeding with entire directory.',
            },
          ],
          isSingleProject: true,
          reasoning: 'Fallback: detection failed',
        };
      }

      // Wait before retry (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  // Should never reach here
  throw new Error('Unexpected error in detectProjects');
}
