import { callLLM } from '../../client/wrapper';
import { ProjectTree } from '../projectTree';
import { FileInfo } from '../../data/types';

/**
 * Step 3-1: Sample Selection with LLM
 *
 * Uses LLM to intelligently select representative sample files
 * when total lines exceed the budget.
 */
export async function selectSampleFilesWithLLM(
  prefix: string,
  projectTree: ProjectTree,
  maxLines: number = 2000,
  model: string = 'gpt-5.1-2025-11-13',
  debug: boolean = false
): Promise<FileInfo[]> {
  // Get all files in this prefix
  const allFiles = projectTree
    .pickByPrefix(prefix)
    .filter(f => f.type === 'file');

  if (allFiles.length === 0) {
    throw new Error(`No files found in prefix: "${prefix}". Please check if the path exists in the project.`);
  }

  // Calculate total lines
  const totalLines = allFiles.reduce((sum, f) => sum + (f.lines || 0), 0);

  // If total lines <= maxLines, return all files
  if (totalLines <= maxLines) {
    if (debug) {
      console.log(`✓ Total lines (${totalLines}) within budget (${maxLines}), returning all ${allFiles.length} files`);
    }
    return allFiles;
  }

  // Otherwise, use LLM to select samples
  if (debug) {
    console.log(`⚠️  Total lines (${totalLines}) exceeds budget (${maxLines})`);
    console.log(`🤖 Using LLM to select representative samples...`);
  }

  const systemPrompt = buildSystemPrompt(maxLines);
  const userPrompt = buildUserPrompt(prefix, allFiles, totalLines);

  if (debug) {
    console.log('\n' + '='.repeat(80));
    console.log('📝 SAMPLE SELECTION PROMPT');
    console.log('='.repeat(80));
    console.log('SYSTEM:\n', systemPrompt);
    console.log('\nUSER:\n', userPrompt);
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
    totalLines: number;
    reasoning?: string;
  };

  if (debug) {
    console.log(`✓ LLM selected ${result.selectedFiles.length} files (${result.totalLines} lines)`);
    if (result.reasoning) {
      console.log(`  Reasoning: ${result.reasoning}`);
    }
  }

  // Map selected paths back to FileInfo objects
  const selectedFiles = result.selectedFiles
    .map(path => allFiles.find(f => f.relativePath === path))
    .filter((f): f is FileInfo => f !== undefined);

  return selectedFiles;
}

/**
 * Build system prompt (instructions)
 */
function buildSystemPrompt(maxLines: number): string {
  return `You are an expert at analyzing codebases and selecting representative sample files.

<목표>
tree를 이용한 거시적 소스코드 분석

주어진 구획의 대표 샘플 파일들을 선택합니다.
- 반복 패턴, 아키텍처 파악
- 최종 산출: 최대 ${maxLines}줄
- 파일 크기: 50-100줄 선호
</목표>

<큰 규모 소스>
파일이 많고 반복 패턴이 있는 경우:

1. 반복되는 네이밍/위치 패턴 찾기 (3회 이상)

2. 메인 기능 패턴만 선택
   - 도메인 비즈니스 로직에 해당하는 패턴만 포함
   - Utility, Config, 공통 인프라 등 보조 기능은 반복되어도 제외

3. 각 패턴당 대표 파일 1개 선출
   - 파일 크기: 50-100줄 선호
   - 최종 산출: 최대 ${maxLines}줄
</큰 규모 소스>

<작은 규모 소스>
파일이 7개 미만이거나 반복 구조가 없는 경우:

1. 네이밍과 폴더 배치로 핵심 파일 유추
2. 메인 기능이 불명확하면 빈 배열 [] 반환
</작은 규모 소스>

<출력 형식>
JSON 형식으로 반환:
{
  "selectedFiles": [
    "path/to/file1.ext",
    "path/to/file2.ext"
  ],
  "totalLines": 1200,
  "reasoning": "선택 이유 간략히 설명 (optional)"
}

빈 배열인 경우:
{
  "selectedFiles": [],
  "totalLines": 0,
  "reasoning": "메인 기능이 불명확하여 스킵"
}
</출력 형식>

위 전략에 따라 대표 샘플을 선택하세요.`;
}

/**
 * Build user prompt (data only)
 */
function buildUserPrompt(
  prefix: string,
  files: FileInfo[],
  totalLines: number
): string {
  const fileList = files
    .map((f, i) => `${i + 1}. ${f.relativePath} (${f.lines || 0} lines)`)
    .join('\n');

  return `<prefix>${prefix}</prefix>

<파일 목록>
${fileList}

Total files: ${files.length}
Total lines: ${totalLines}
</파일 목록>`;
}
