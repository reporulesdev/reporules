/**
 * Global Rules Generation
 *
 * Generates project-wide common rules (global.md)
 */

import { callLLM } from '../../client/wrapper';
import { PreliminaryAnalysisResult, SampleFile } from '../../data/types';
import { ProjectTree } from '../projectTree';
import { readFileSync } from 'fs';
import { join } from 'path';
import { compressGlobalGuide } from './compressGlobalGuide';

/**
 * Step 1: Select sample files for global rules analysis
 *
 * Selects 5-15 files from across the entire project
 */
export async function selectGlobalSampleFiles(
  projectTree: ProjectTree,
  model: string = 'gpt-4o-mini',
  debug: boolean = false
): Promise<string[]> {
  // Get all files
  const allFiles = projectTree.pickByPrefix('')
    .filter(f => f.type === 'file');

  const totalFiles = allFiles.length;

  if (debug) {
    console.log(`📊 Total project files: ${totalFiles}`);
  }

  // Build tree string
  const treeString = projectTree.toTreeString();

  const systemPrompt = buildSampleSelectionSystemPrompt();
  const userPrompt = buildSampleSelectionUserPrompt(treeString, totalFiles);

  if (debug) {
    console.log('\n' + '='.repeat(80));
    console.log('📝 GLOBAL SAMPLE SELECTION PROMPT');
    console.log('='.repeat(80));
    console.log('SYSTEM:\n', systemPrompt.substring(0, 300) + '...');
    console.log('\nUSER:\n', userPrompt.substring(0, 300) + '...');
    console.log('='.repeat(80) + '\n');
  }

  const content = await callLLM({
    systemPrompt,
    userPrompt,
    model,
    temperature: 0.1,
    jsonMode: true,
    debug
  });

  const result = JSON.parse(content) as {
    selectedFiles: string[];
    reasoning?: string;
  };

  // Normalize paths: LLM sees tree string that includes root folder name (e.g., "template/")
  // but FileInfo.relativePath is relative to rootPath (e.g., "api/ItemsController.java").
  // Strip the leading root folder component if needed.
  const allFilePaths = new Set(allFiles.map(f => f.relativePath));
  const normalizedPaths = result.selectedFiles
    .map(p => {
      if (allFilePaths.has(p)) return p;
      // Try stripping the first path component (e.g., "template/foo.java" → "foo.java")
      const stripped = p.split('/').slice(1).join('/');
      if (stripped && allFilePaths.has(stripped)) return stripped;
      return null; // unknown path - discard
    })
    .filter((p): p is string => p !== null);

  if (debug) {
    console.log(`✓ Selected ${normalizedPaths.length} global sample files`);
    if (result.reasoning) {
      console.log(`  Reasoning: ${result.reasoning}`);
    }
    normalizedPaths.forEach((path, i) => {
      console.log(`  ${i + 1}. ${path}`);
    });
    console.log();
  }

  return normalizedPaths;
}

/**
 * Step 2: Generate global rules document
 */
export async function generateGlobalRules(
  projectRoot: string,
  sampleFiles: SampleFile[],
  prelimResult: PreliminaryAnalysisResult,
  model: string = 'gpt-4o-mini',
  debug: boolean = false
): Promise<string> {
  const systemPrompt = buildGlobalRulesSystemPrompt(prelimResult);
  const userPrompt = buildGlobalRulesUserPrompt(sampleFiles);

  if (debug) {
    console.log('\n' + '='.repeat(80));
    console.log('📝 GLOBAL RULES GENERATION PROMPT');
    console.log('='.repeat(80));
    console.log('SYSTEM:\n', systemPrompt.substring(0, 500) + '...');
    console.log('\nUSER:\n', userPrompt.substring(0, 500) + '...');
    console.log('='.repeat(80) + '\n');
  }

  let content = await callLLM({
    systemPrompt,
    userPrompt,
    model,
    temperature: 0.2,
    debug
  });

  // Post-process: Compress global guide
  content = await compressGlobalGuide(content, model, debug);

  return content;
}

/**
 * Build system prompt for global sample selection
 */
function buildSampleSelectionSystemPrompt(): string {
  return `You are an expert at analyzing project structures. Respond with JSON only.

<goal>
프로젝트의 전반적인 규칙을 파악하기 위한 샘플 파일을 선택하세요.
</goal>

<task>
프로젝트 규모에 따라 **최소 5개, 최대 15개**의 파일 경로를 선택하세요.

선택 기준:
1. **모든 모듈/폴더에 골고루** 분산
   - 한 모듈에 집중하지 말고 다양한 위치에서 선택

2. **파일 역할이 다양**하게:
   - 데이터 클래스 (DTO, Entity, Model, Doc, Command, Request)
   - 로직 클래스 (Service, Repository, Util, Mapper, Search)
   - 설정/진입점 클래스 (Config, Main, Application)

3. **소스 코드만** 포함:
   - ✅ .java, .py, .js, .ts, .go, .rs, .kt 등
   - ❌ manifest, config, build 파일 제외
   - ❌ package.json, pom.xml, build.gradle 등 제외

규모별 가이드:
- 소규모 (< 50 파일): 5-7개
- 중규모 (50-200 파일): 8-12개
- 대규모 (> 200 파일): 12-15개
</task>

<output-format>
JSON 형식으로 반환:
{
  "selectedFiles": [
    "path/to/file1.java",
    "path/to/file2.py"
  ],
  "reasoning": "선택 이유 (optional)"
}

중요: 파일 경로는 정확히 프로젝트 트리에 있는 경로를 사용하세요.
</output-format>`;
}

/**
 * Build user prompt for global sample selection
 */
function buildSampleSelectionUserPrompt(
  treeString: string,
  totalFiles: number
): string {
  return `<프로젝트 트리>
${treeString}
</프로젝트 트리>

<프로젝트 규모>
총 ${totalFiles} 파일
</프로젝트 규모>`;
}

/**
 * Build system prompt for global rules generation
 */
function buildGlobalRulesSystemPrompt(
  prelimResult: PreliminaryAnalysisResult
): string {
  const language = prelimResult.language;
  const buildSystem = prelimResult.buildSystem || 'N/A';
  const frameworks = prelimResult.architecturePattern || 'N/A';

  return `You are an expert software architect creating project-wide coding guidelines. Respond with a well-structured markdown document.

<goal>
프로젝트 전체에 적용될 공통 규칙(global rules)을 생성합니다.

이 규칙은 모든 코드 작성 시 참고할 가이드입니다.
</goal>

<project-info>
언어: ${language}
빌드 시스템: ${buildSystem}
아키텍처 패턴: ${frameworks}
</project-info>

<task>
다음 3단계로 구성된 공통 규칙 문서를 작성하세요:

1. **언어와 프레임워크 가이드**
   - ${language}에서 중요한 원칙 (SRP, DRY, SOLID 등)
   - ${frameworks} 아키텍처 패턴의 핵심 원칙
   - 해당 언어/프레임워크의 베스트 프랙티스

2. **공통 적용 규칙**
   - 네이밍 규칙
   - 에러 핸들링
   - 로깅
   - 테스트
   - 코드 구조

3. **프로젝트별 권장사항** (샘플 코드 분석 기반)
   - **권장 규칙 5개** (중요도 순서):
     - 이 프로젝트에서 반드시 지켜야 할 규칙
     - 예: "불변 객체 사용", "빌더 패턴 선호"

   - **암시 규칙 5개** (중요도 순서):
     - 명시적이지 않지만 코드에서 관찰되는 패턴
     - 예: "Lombok 애노테이션 사용", "private 필드 + getter"
</task>

<output-format>
다음 형식의 마크다운 문서를 생성하세요:

\`\`\`markdown
---
paths:
  - "**/*"
---

# Global Coding Rules

## 📖 이 문서에 대하여

이 문서는 프로젝트 전체에 적용되는 공통 코딩 가이드입니다.

**이것은 가이드이지 절대적인 규칙이 아닙니다.**
- 개발할 때 참고 자료로 활용하되, 억지로 따를 필요는 없습니다
- 가이드가 애매하거나 프로젝트 상황과 맞지 않으면, **사용자에게 피드백을 요청**하세요
- 실제 요구사항과 프로젝트 상황에 따라 유연하게 적용하세요

---

## 1. 언어와 프레임워크 원칙

### ${language} 핵심 원칙
- SRP (Single Responsibility Principle): ...
- DRY (Don't Repeat Yourself): ...
- ...

### ${frameworks} 아키텍처 원칙
- ...

---

## 2. 공통 적용 규칙

### 네이밍 규칙
- 클래스: PascalCase
- 메서드/변수: camelCase
- ...

### 에러 핸들링
- ...

### 로깅
- ...

### 테스트
- ...

---

## 3. 프로젝트별 권장사항

### ✅ 권장 규칙 (Must Follow)

**1. [규칙명]**
- 설명: ...
- 이유: ...
- 예시:
\`\`\`${language}
// Good
...
\`\`\`

**2. [규칙명]**
...

(총 5개)

### 💡 암시 규칙 (Observed Patterns)

**1. [패턴명]**
- 관찰: ...
- 권장: ...

**2. [패턴명]**
...

(총 5개)

---

## 참고

- 특정 모듈/구획의 규칙은 해당 경로의 rules를 참고하세요
- 이 규칙과 모듈별 규칙이 충돌하면, 모듈별 규칙을 우선 적용하세요
\`\`\`
</output-format>

<instructions>
1. 샘플 코드를 **실제로 분석**하여 관찰되는 패턴 기반으로 작성
2. 권장/암시 규칙은 구체적이고 실용적으로
3. 예시 코드는 간결하게 (5-10줄)
4. 추상적인 원칙보다는 **실제 적용 가능한 가이드** 제공
</instructions>`;
}

/**
 * Build user prompt for global rules generation
 */
function buildGlobalRulesUserPrompt(
  sampleFiles: SampleFile[]
): string {
  const samplesText = sampleFiles.map((file, i) =>
    `<file-${i + 1}>\nPath: ${file.path}\n\n${file.content}\n</file-${i + 1}>`
  ).join('\n\n');

  return `<sample-files>
${samplesText}
</sample-files>`;
}

/**
 * Read sample files from disk
 */
export async function readGlobalSampleFiles(
  projectRoot: string,
  filePaths: string[]
): Promise<SampleFile[]> {
  const sampleFiles: SampleFile[] = [];

  for (const filePath of filePaths) {
    try {
      const fullPath = join(projectRoot, filePath);
      const content = readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');

      // Truncate if too long (max 300 lines per file)
      const truncatedContent = lines.length > 300
        ? lines.slice(0, 300).join('\n') + `\n\n... (truncated, ${lines.length - 300} more lines)`
        : content;

      sampleFiles.push({
        path: filePath,
        content: truncatedContent,
        lines: Math.min(lines.length, 300),
      });
    } catch (error) {
      console.log(`⚠️  Failed to read file: ${filePath}`);
    }
  }

  return sampleFiles;
}
