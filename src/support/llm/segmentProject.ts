import { callLLM } from '../../client/wrapper';
import { DetailedAnalysisResult, PreliminaryAnalysisResult } from '../../data/types';
import { ProjectTree } from '../projectTree';

/**
 * Step 2: Detailed Analysis
 *
 * Analyzes project structure and determines:
 * - Whether to segment the project into meaningful prefixes
 * - What prefixes to use for rule generation
 * - Validates prefixes against actual project tree
 * - Retries up to 3 times if invalid prefixes are returned
 */
export async function segmentProject(
  treeString: string,
  projectTree: ProjectTree,
  configFiles: Map<string, string>,
  prelimResult: PreliminaryAnalysisResult,
  model: string = 'gpt-5.1-2025-11-13',
  debug: boolean = false,
  userRequest?: string,
  previousResult?: DetailedAnalysisResult
): Promise<DetailedAnalysisResult> {
  const maxAttempts = 3;
  let attempt = 0;
  let failedPrefixes: string[] = [];
  let validPrefixes: string[] = [];

  while (attempt < maxAttempts) {
    attempt++;

    // Build prompts
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(
      treeString,
      configFiles,
      prelimResult,
      failedPrefixes.length > 0 ? failedPrefixes : undefined,
      userRequest,
      previousResult
    );

    // Debug: Print prompts if requested
    if (debug) {
      console.log('\n' + '='.repeat(80));
      console.log(`📝 PROMPT (Attempt ${attempt}/${maxAttempts})`);
      console.log('='.repeat(80));
      console.log('SYSTEM:\n', systemPrompt.substring(0, 300) + '...');
      console.log('\nUSER:\n', userPrompt.substring(0, 500) + '...');
      console.log('='.repeat(80) + '\n');
    }

    // Call LLM
    const content = await callLLM({
      systemPrompt,
      userPrompt,
      model,
      temperature: 0.1,
      jsonMode: true,
      debug
    });

    const rawResult = JSON.parse(content) as { prefixes: string[] };

    // Auto-correct: If project has single top-level directory, prepend it
    const correctedPrefixes = autoCorrectPrefixes(rawResult.prefixes, projectTree);

    // Validate each prefix
    validPrefixes = [];
    const invalidPrefixes: string[] = [];

    for (const prefix of correctedPrefixes) {
      const matchedFiles = projectTree.pickByPrefix(prefix);
      if (matchedFiles.length > 0) {
        validPrefixes.push(prefix);
      } else {
        invalidPrefixes.push(prefix);
      }
    }

    // If all prefixes are valid, success!
    if (invalidPrefixes.length === 0) {
      return { prefixes: validPrefixes };
    }

    // If some failed, prepare for retry
    failedPrefixes = invalidPrefixes;
    console.log(`⚠️  Attempt ${attempt}: Found ${invalidPrefixes.length} invalid prefix(es): ${invalidPrefixes.join(', ')}`);

    // If this was the last attempt, return what we have
    if (attempt === maxAttempts) {
      console.log(`⚠️  Max attempts reached. Returning ${validPrefixes.length} valid prefix(es).`);
      // If no valid prefixes, default to global
      if (validPrefixes.length === 0) {
        console.log('⚠️  No valid prefixes found. Defaulting to global rules [""].');
        return { prefixes: [''] };
      }
      return { prefixes: validPrefixes };
    }

    console.log(`🔄 Retrying with warning message... (Attempt ${attempt + 1}/${maxAttempts})`);
  }

  // Fallback (should never reach here, but TypeScript requires it)
  return { prefixes: validPrefixes.length > 0 ? validPrefixes : [''] };
}

/**
 * Build system prompt (instructions)
 */
function buildSystemPrompt(): string {
  return `You are an expert software architect analyzing project structures. Respond with JSON only.

<goal>
이 프로젝트에 대한 코딩 규칙을 생성하기 위해, 서로 다른 코딩 컨벤션을 가질 가능성이 있는 구획(segment)으로 나누세요.

목적: 각 구획별로 별도의 규칙 파일을 생성할 것입니다.
기준: 코딩 스타일, 네이밍 규칙, 아키텍처 레이어가 다른 단위로 구분하세요.

예시:
- Hexagonal 아키텍처: port, adapter, domain 등 레이어 단위로 분리
- Multi-module: 각 모듈이 다른 역할을 하면 모듈 단위로 분리
- Layered: model, service, controller 등 레이어 단위로 분리

정형화된 소프트웨어 아키텍처를 따르지 않는 경우:
- 설정 파일의 내용 (dependencies, plugins, configuration)
- 디렉토리의 이름 (api, util, core, domain 등)
- 내부 파일의 패턴 (파일명, 확장자, 구조)
위 근거를 종합하여 판단하세요.

주의: 나눈다면 [""] (global)을 포함하지 마세요. 나누지 않을 때만 [""]를 반환하세요.
</goal>

=== 판단 규칙 ===

<multi-module>
규칙: 첨부한 파일을 봤을 때, 시스템적으로 파일을 나누는 구분이 명확한가?
- 각 구획이 다른 코딩 컨벤션/규칙을 가질 확률이 높은가?
- 예시: Spring의 멀티 모듈 구조 (각 모듈이 다른 빌드 설정, 의존성)
</multi-module>

<architecture-boundary>
규칙: 네이밍과 트리에서 보이는 구조가 명백한 특정 소프트웨어 아키텍처를 따르는가?
- 예시: 헥사고날 아키텍처, port & adapter 구조
- 폴더명이나 구조에서 아키텍처 패턴이 명확하게 드러나는가?
</architecture-boundary>

<uncertain-cases>
규칙: 이름만으로는 판단 불가인 경우
- 구획으로 지정하지 마십시오
- 이러한 부분은 global 규칙을 따르게 됩니다
</uncertain-cases>

<flexible-structure>
규칙: 명백한 구조가 없는 경우 (특정 아키텍처를 따르지 않고 유연하게 작성된 코드)
- 주요 상위 폴더의 이름과 하위 리소스의 이름을 통해 주요 폴더를 파악
- 그것만 명시하시오
</flexible-structure>

<prefixes>
규칙: Prefix는 디렉토리 경로로 표현
- 나눈다면: ["modules/api/", "modules/service/", "modules/core/"]
- 나누지 않는다면: [""]

주의사항:
- Prefix는 반드시 trailing slash(/) 포함
- **Tree에 실제로 존재하는 경로만** 반환하세요
- 불확실하면 나누지 마십시오 (global 규칙 사용)
</prefixes>

=== Output Format ===
Return JSON only:
{
  "prefixes": string[]
}

=== General Principles ===
- 불확실하면 나누지 않는 것이 안전합니다 ([""] 반환)
- 각 prefix는 의미있는 규칙 차이가 있을 때만 분리하세요
- 너무 세분화하지 마십시오
- **반드시 트리에 존재하는 경로만 반환하세요**
`;
}

/**
 * Build user prompt (data only)
 */
function buildUserPrompt(
  tree: string,
  configFiles: Map<string, string>,
  prelimResult: PreliminaryAnalysisResult,
  failedPrefixes?: string[],
  userRequest?: string,
  previousResult?: DetailedAnalysisResult
): string {
  // Warning section for retries
  let warningSection = '';
  if (failedPrefixes && failedPrefixes.length > 0) {
    warningSection = `⚠️ **이전 시도 경고**
다음 경로에서 디렉토리를 찾는데 실패했습니다: ${failedPrefixes.map(p => `"${p}"`).join(', ')}

올바른 prefix 구조를 반환하는데 집중해주세요.
올바른 prefix 예시:
  - "modules/api/"
  - "src/services/"
  - "apps/frontend/"
  - "" (전체 프로젝트)

실제 트리 구조를 다시 확인하고 **존재하는 경로만** 반환하세요.
Prefix는 반드시 trailing slash(/)를 포함해야 합니다.

`;
  }

  // User request section for refinement
  let userSection = '';
  if (userRequest || previousResult) {
    userSection = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 사용자 요청 및 이전 결과
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${userRequest ? `<user-request>
사용자 요청:
${userRequest}
</user-request>

` : ''}${previousResult ? `<previous-result>
이전 분석 결과 (개선이 필요합니다):
${previousResult.prefixes.map((p, i) => `  ${i+1}. "${p}"`).join('\n')}

사용자가 요청한 부분을 중심으로 이전 결과를 개선하세요.
너무 큰 prefix는 세분화하고, 사용자가 집중하라고 한 부분은 더 세밀하게 나누세요.
</previous-result>

` : ''}<주의>
**유저 리퀘스트가 있다면, 가장 중요하게 우선적으로 반영하세요.**
이전 결과의 문제점을 개선하는 방향으로 다시 분석하세요.
사용자가 요청한 부분에 집중하여 더 세밀하게 구획을 나누세요.
</주의>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
  }

  return `${warningSection}${userSection}<step1-result>
Step 1에서 추출한 프로젝트 특성:
- Language: ${prelimResult.language}
- Architecture Pattern: ${prelimResult.architecturePattern}
- Complexity: ${prelimResult.complexity}
- Structure Level: ${prelimResult.structureLevel || 'N/A'}
- Build System: ${prelimResult.buildSystem || 'N/A'}
</step1-result>

<project-tree>
${tree}
</project-tree>

<config-files>
${formatConfigFiles(configFiles)}
</config-files>
`;
}

/**
 * Auto-correct prefixes if project has single top-level directory
 *
 * Example:
 * - Project structure: hard-repo/openclaw/apps/, hard-repo/openclaw/extensions/
 * - LLM returns: ["apps/", "extensions/"]
 * - Auto-corrected: ["openclaw/apps/", "openclaw/extensions/"]
 */
function autoCorrectPrefixes(prefixes: string[], projectTree: ProjectTree): string[] {
  // Get all top-level directories (depth 0)
  const allFiles = projectTree.getFiles();
  const topLevelDirs = new Set<string>();

  allFiles
    .filter(f => f.type === 'directory' && f.depth === 0)
    .forEach(f => topLevelDirs.add(f.relativePath));

  // If exactly one top-level directory, prepend it to all prefixes
  if (topLevelDirs.size === 1) {
    const topDir = Array.from(topLevelDirs)[0];
    console.log(`🔧 Auto-correction: Detected single top-level directory "${topDir}/"`);
    console.log(`   Prepending to all prefixes...`);

    return prefixes.map(prefix => {
      // Skip if already starts with top dir
      if (prefix.startsWith(topDir + '/')) {
        return prefix;
      }
      // Skip global prefix
      if (prefix === '') {
        return prefix;
      }
      // Prepend top dir
      return `${topDir}/${prefix}`;
    });
  }

  // Otherwise, return as-is
  return prefixes;
}

/**
 * Format config files for prompt
 */
function formatConfigFiles(configFiles: Map<string, string>): string {
  if (configFiles.size === 0) {
    return '(No config files provided)';
  }

  let result = '';
  configFiles.forEach((content, path) => {
    result += `--- ${path} ---\n`;
    result += content + '\n\n';
  });
  return result;
}
