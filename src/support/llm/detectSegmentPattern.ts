import { callLLM } from '../../client/wrapper';
import { FileInfo } from '../../data/types';

/**
 * Structure Classification Result
 */
export interface StructureClassification {
  structured: boolean;    // true = 구조 있음, false = flat
  confidence: number;     // 0.0 ~ 1.0
  reasoning: string;
}

/**
 * Subdirectory Information
 */
interface SubdirectoryInfo {
  name: string;
  fileCount: number;
  subdirCount: number;
}

/**
 * Classify if a prefix has structure (2-way classification)
 *
 * - flat (structured=false): 구조 없음, 규칙 생성 스킵
 * - structured (structured=true): 구조 있음, 이후 template-based/decomposed 판단
 */
export async function detectSegmentPattern(
  prefix: string,
  sampleFiles: FileInfo[],
  model: string = 'gpt-4o-mini',
  debug: boolean = false
): Promise<StructureClassification> {
  // Build prompts
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(prefix, sampleFiles);

  if (debug) {
    console.log('\n' + '='.repeat(80));
    console.log('📝 CLASSIFY STRUCTURE PROMPT');
    console.log('='.repeat(80));
    console.log('SYSTEM:\n', systemPrompt.substring(0, 500) + '...');
    console.log('\nUSER:\n', userPrompt);
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

  const result = JSON.parse(content) as StructureClassification;

  if (debug) {
    console.log('✓ Classification complete');
    console.log(`  Structured: ${result.structured}`);
    console.log(`  Confidence: ${result.confidence}`);
    console.log(`  Reasoning: ${result.reasoning}`);
  }

  return result;
}

/**
 * Build system prompt (instructions)
 */
function buildSystemPrompt(): string {
  return `You are an expert at analyzing code structure. Respond with JSON only.

<goal>
주어진 구획이 **구조화되어 있는지** 판단합니다.

2가지 결과:
1. **flat** (structured=false): 구조 없음 → 규칙 생성 스킵
2. **structured** (structured=true): 구조 있음 → template-based or decomposed 판단 필요

**핵심 원칙: 의심스러우면 flat으로 판단하세요.**
</goal>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
flat vs structured 구분 방법
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<flat>
## 정의
**구조화되지 않은** 코드입니다.
도메인별/레이어별 명확한 구분 없이 파일들이 모여있거나,
구조의 지속성을 판단하기 어려운 경우입니다.

## 특징
- 유틸리티, 헬퍼, 공통 라이브러리 성격
- 파일/폴더 개수와 무관 (1개든 100개든 flat 가능)
- 레거시 코드로 여러 목적이 혼재
- 단순 그룹핑 폴더 (utils/, helpers/, filter/)
- 아키텍처 의도 불명확
- 파일 수가 적어서 구조의 지속성 판단 어려움

## 예시

**Example 1: 유틸리티 (파일 1개)**
\`\`\`
encryption/
  devrunner/encryption/EmailEncryptor.java
\`\`\`
→ 유틸리티 1개. 도메인/레이어 구분 없음.
→ **flat**

**Example 2: 유틸리티 라이브러리 (파일 7개)**
\`\`\`
openai-base/
  devrunner/openaibase/AbstractGptRunner.java
  devrunner/openaibase/ListGptRunner.java
  devrunner/openaibase/SingleGptRunner.java
  devrunner/openaibase/GptParams.java
  devrunner/openaibase/GptResponse.java
  ...
\`\`\`
→ GPT 실행을 위한 추상화 유틸리티 모음.
→ devrunner/openaibase는 Java 패키지일 뿐, 아키텍처 레이어 아님.
→ 도메인 확장이나 레이어 분해 의도 없음.
→ **flat**

**Example 3: 단순 그룹핑 (파일 3개, 폴더 1개)**
\`\`\`
logging/
  devrunner/logging/LoggingFilter.java
  devrunner/logging/RequestLoggingInterceptor.java
  devrunner/filter/CorsFilter.java
\`\`\`
→ logging과 filter는 단순 그룹핑.
→ 파일 수 적고, 구조의 지속성 판단 어려움.
→ controller/, service/, repository/ 같은 보편적 레이어 네이밍 없음.
→ **flat**

**Example 4: 레거시 (폴더 69개)**
\`\`\`
src/
  gateway/           (외부 연동)
  discord/           (플랫폼)
  slack/             (플랫폼)
  utils/             (유틸)
  cli/               (인터페이스)
  auth/              (기능)
  ... (69개 폴더)
\`\`\`
→ 폴더 분류 기준이 제각각 (기능, 플랫폼, 유틸 혼재).
→ 일관된 아키텍처 의도 없음.
→ "잡동사니" 느낌.
→ **flat**

**Example 5: 파일 적음 + 불명확**
\`\`\`
config/
  database/DatabaseConfig.java
  security/SecurityConfig.java
\`\`\`
→ 파일 2개, 설정 파일.
→ 구조의 지속성 판단 불가.
→ **flat**
</flat>

<structured>
## 정의
**명확한 구조**가 있는 코드입니다.
도메인별 OR 레이어별로 조직화되어 있고,
구조의 지속성과 확장 의도가 명확합니다.

## 특징
- 도메인별 폴더 반복 (bookmark/, user/, comment/)
- 레이어별 폴더 분해 (api/, query/, document/, mapper/)
- 보편적 아키텍처 네이밍 (controller/, service/, repository/)
- 각 하위 폴더가 명확한 책임
- 구조가 지속될 것으로 예상됨

## 예시

**Example 1: 도메인별 CQRS (파일 57개)**
\`\`\`
service/
  bookmark/BookmarkReader.java, BookmarkWriter.java, DefaultBookmarkService.java
  comment/CommentReader.java, CommentWriter.java, DefaultCommentService.java
  user/UserReader.java, UserWriter.java, DefaultUserService.java
  post/PostReader.java, PostWriter.java
  ...
\`\`\`
→ bookmark, comment, user 등 여러 도메인이 동일한 Reader/Writer 패턴 반복.
→ 도메인별 폴더 구조 명확.
→ **structured** (template-based)

**Example 2: 레이어별 검색 (파일 78개)**
\`\`\`
elasticsearch/
  agg/BookmarkCountAggregation.java, UserStatsAggregation.java
  api/BookmarkSearch.java, CommentSearch.java
  document/BookmarkDoc.java, CommentDoc.java
  query/BookmarkQuery.java, UserQuery.java
  mapper/BookmarkMapper.java
\`\`\`
→ agg(집계), api(파사드), document(모델), query(쿼리), mapper(변환)
→ 검색 기능을 여러 레이어로 분해한 구조.
→ **structured** (decomposed)

**Example 3: 도메인별 Repository (파일 45개)**
\`\`\`
repository-jdbc/
  bookmark/BookmarkEntity.java, BookmarkRepository.java, BookmarkEntityIdentity.java
  comment/CommentEntity.java, CommentRepository.java
  user/UserEntity.java, UserRepository.java
\`\`\`
→ 여러 도메인이 Entity/Repository/Identity 패턴 반복.
→ **structured** (template-based)

**Example 4: 작지만 레이어링 의도 명확 (파일 5개)**
\`\`\`
api/
  controller/UserController.java
  service/UserService.java
  repository/UserRepository.java
\`\`\`
→ 파일은 적지만 controller, service, repository는 보편적 레이어 네이밍.
→ 레이어링 아키텍처 의도 명확.
→ 확장 시 각 레이어에 파일 추가될 것으로 예상.
→ **structured** (decomposed)
</structured>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
판단 방법
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

위의 예시들을 참고하여, 입력 데이터가 어느 쪽에 가까운지 평가하세요.

<evaluation-guide>
1. **폴더 구조 관찰**
   - 하위 폴더들이 도메인별로 반복되는가? (bookmark/, user/, comment/)
     → structured 가능성

   - 하위 폴더들이 레이어별로 분해되는가? (api/, query/, document/, mapper/)
     → structured 가능성

   - 하위 폴더가 거의 없거나, 단순 그룹핑인가? (utils/, helpers/, filter/)
     → flat 가능성

2. **네이밍 의도 파악**
   - controller/, service/, repository/ 같은 보편적 아키텍처 용어?
     → 레이어링 의도 명확 → structured

   - filter/, helpers/, util/ 같은 단순 그룹핑?
     → 구조 의도 불명확 → flat

3. **구조의 지속성 판단**
   - 파일 수가 많고, 패턴이 반복되는가?
     → 구조가 지속될 것으로 예상 → structured

   - 파일 수가 적고, 향후 확장 방향 불명확?
     → 구조 지속성 판단 어려움 → flat

4. **Java 패키지 vs 아키텍처 레이어**
   - devrunner/logging/LoggingFilter.java
     → "devrunner/logging"은 Java 패키지일 뿐, 아키텍처 레이어 아님
     → 실제 폴더 구조 확인 필요

5. **의심스러울 때**
   - 애매하거나 불명확하면 → **flat**
   - 잘못된 규칙을 만드는 것보다, 규칙을 만들지 않는 것이 낫습니다.
</evaluation-guide>

<confidence>
- 명확함: 0.9-1.0
- 대체로 맞음: 0.7-0.8
- 애매함: 0.5-0.6 (애매하면 flat으로)
</confidence>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
출력 형식
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

JSON:
{
  "structured": true | false,
  "confidence": 0.9,
  "reasoning": "구체적 근거 (1-2문장)"
}

<examples>
{
  "structured": false,
  "confidence": 0.95,
  "reasoning": "하위 폴더가 없고 유틸리티 파일만 있습니다. 도메인이나 레이어 구분 없음."
}

{
  "structured": true,
  "confidence": 0.92,
  "reasoning": "bookmark, comment, user 등 도메인별 폴더가 명확합니다."
}

{
  "structured": false,
  "confidence": 0.85,
  "reasoning": "gateway, discord, utils 등 폴더 분류 기준이 제각각이며 일관된 구조 없음."
}
</examples>

위 정보를 바탕으로 주어진 구획이 구조화되어 있는지 판단하세요.`;
}

/**
 * Build user prompt (data only)
 */
function buildUserPrompt(
  prefix: string,
  sampleFiles: FileInfo[]
): string {
  // Calculate statistics
  const fileCount = sampleFiles.filter(f => f.type === 'file').length;
  const dirCount = sampleFiles.filter(f => f.type === 'directory').length;

  // Analyze subdirectories
  const subdirs = analyzeSubdirectories(sampleFiles);

  return `<prefix>${prefix}</prefix>

<statistics>
- 파일 수: ${fileCount}
- 디렉토리 수: ${dirCount}
</statistics>

<subdirectories>
${formatSubdirectories(subdirs)}
</subdirectories>

<sample-paths>
${sampleFiles
  .filter(f => f.type === 'file')
  .slice(0, 30)
  .map(f => f.relativePath)
  .join('\n')}

${fileCount > 30 ? `\n... (${fileCount - 30}개 파일 생략)` : ''}
</sample-paths>`;
}

/**
 * Analyze subdirectories
 */
function analyzeSubdirectories(files: FileInfo[]): SubdirectoryInfo[] {
  if (files.length === 0) return [];

  // Find minimum depth (the root of this prefix)
  const minDepth = Math.min(...files.map(f => f.depth));

  // Get top-level subdirectories (depth = minDepth + 1)
  const topLevelDirs = files.filter(
    f => f.type === 'directory' && f.depth === minDepth + 1
  );

  return topLevelDirs.map(dir => ({
    name: dir.name,
    fileCount: files.filter(f =>
      f.relativePath.startsWith(dir.relativePath + '/') && f.type === 'file'
    ).length,
    subdirCount: files.filter(f =>
      f.relativePath.startsWith(dir.relativePath + '/') &&
      f.type === 'directory' &&
      f.depth > dir.depth
    ).length
  }));
}

/**
 * Format subdirectories for prompt
 */
function formatSubdirectories(subdirs: SubdirectoryInfo[]): string {
  if (subdirs.length === 0) {
    return '(하위 디렉토리 없음)';
  }

  return subdirs.map(s =>
    `- ${s.name}/ (파일 ${s.fileCount}개, 하위 디렉토리 ${s.subdirCount}개)`
  ).join('\n');
}
