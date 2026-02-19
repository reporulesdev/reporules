import { callLLM } from '../../client/wrapper';
import { FileInfo, PatternAnalysisResult } from '../../data/types';

/**
 * Prefix Structure Types (for structured code only)
 */
export type SegmentStructureType = 'template-based' | 'decomposed';

/**
 * Prefix Structure Classification Result
 */
export interface SegmentClassification {
  type: SegmentStructureType;
  confidence: number;  // 0.0 ~ 1.0
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
 * Step 2.5: Classify Prefix Structure
 *
 * Classifies the structure type of a prefix to determine
 * the appropriate rule generation strategy
 */
export async function classifySegmentType(
  prefix: string,
  sampleFiles: FileInfo[],
  patterns: PatternAnalysisResult,
  model: string = 'gpt-5.1-2025-11-13',
  debug: boolean = false
): Promise<SegmentClassification> {
  // Build prompts
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(prefix, sampleFiles, patterns);

  if (debug) {
    console.log('\n' + '='.repeat(80));
    console.log('📝 CLASSIFY PREFIX STRUCTURE PROMPT');
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

  const result = JSON.parse(content) as SegmentClassification;

  if (debug) {
    console.log('✓ Classification complete');
    console.log(`  Type: ${result.type}`);
    console.log(`  Confidence: ${result.confidence}`);
    console.log(`  Reasoning: ${result.reasoning}`);
  }

  return result;
}

/**
 * Build system prompt (instructions)
 */
function buildSystemPrompt(): string {
  return `You are an expert at analyzing code structure and architecture patterns. Respond with JSON only.

<goal>
주어진 구획의 구조 타입을 분류합니다.

**전제: 이 코드는 이미 structured로 분류되었습니다. (flat이 아님)**

이제 다음 2가지 중 하나를 선택합니다:
1. **template-based**: 같은 패턴이 여러 도메인/엔티티에 반복 (수평 확장)
2. **decomposed**: 특정 기능을 여러 레이어로 분해 (수직 분해)

이 분류는 규칙 생성 전략을 결정하는 데 사용됩니다.
</goal>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
template-based vs decomposed 구분 방법
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<template-based>
## 정의
**같은 패턴이 여러 하위 디렉토리에 반복되는 구조** (Horizontal Repetition)

도메인/엔티티별로 폴더가 나뉘고, 각 폴더에서 동일한 패턴이 반복됩니다.

## 핵심 특징
- **Homogeneous (동질적)**: 하위 폴더들이 동일한 구조
- **수평적 확장**: 새 도메인 추가 = 기존 폴더 복사 + 이름 변경
- **템플릿 복제**: 1개 폴더 보면 전체 구조 이해 가능
- **패턴 반복**: 같은 패턴이 여러 폴더에 걸쳐 반복
- **10~20% 예외 허용**: 일부 파일이 패턴을 벗어나도 대다수가 일관되면 OK

## 예시

**Example 1: CQRS 도메인별 (파일 57개)**
\`\`\`
service/
  auth/
    AuthReader.java
    AuthWriter.java
    DefaultAuthService.java
  bookmark/
    BookmarkReader.java
    BookmarkWriter.java
    DefaultBookmarkService.java
  comment/
    CommentReader.java
    CommentWriter.java
    DefaultCommentService.java
  user/
    UserReader.java
    UserWriter.java
    DefaultUserService.java
  ...
\`\`\`

**패턴:**
- *Reader (읽기)
- *Writer (쓰기)
- Default*Service (파사드)

**판단 근거:**
→ bookmark, comment, user 등 여러 도메인 폴더가 모두 동일한 Reader/Writer/Service 패턴 반복
→ 새 도메인(예: product) 추가 시 기존 폴더 복사하면 됨
→ **template-based**

**Example 2: Repository 도메인별 (파일 45개)**
\`\`\`
repository-jdbc/
  bookmark/
    BookmarkEntity.java
    BookmarkRepository.java
    BookmarkEntityIdentity.java
  comment/
    CommentEntity.java
    CommentRepository.java
    CommentEntityIdentity.java
  job/
    JobEntity.java
    JobRepository.java
  user/
    UserEntity.java
    UserRepository.java
    UserEntityIdentity.java
  ...
\`\`\`

**패턴:**
- *Entity (엔티티)
- *Repository (리포지토리)
- *EntityIdentity (복합키)

**판단 근거:**
→ 여러 도메인이 Entity/Repository/Identity 패턴 반복
→ 각 도메인 폴더가 동일한 구조
→ **template-based**

**Example 3: 도메인 모델 (파일 48개)**
\`\`\`
model/
  activityLog/ActivityLog.java
  bookmark/Bookmark.java, BookmarkFilter.java
  comment/Comment.java, CommentFilter.java
  job/Job.java, JobStatus.java
  user/User.java, UserProfile.java
  ...
\`\`\`

**패턴:**
- *.java (도메인 모델)
- *Filter.java (필터)
- *Status.java (상태)

**판단 근거:**
→ 도메인별 폴더 구조
→ 각 도메인마다 모델 + 필터/상태 패턴 반복
→ **template-based**
</template-based>

<decomposed>
## 정의
**특정 기능을 여러 관점/레이어로 분해한 구조** (Vertical Decomposition)

단일 기능 영역을 제공하기 위해 여러 책임으로 나눈 구조입니다.

## 핵심 특징
- **Heterogeneous (이질적)**: 각 하위 폴더가 서로 다른 역할
- **수직적 분해**: 하나의 기능을 여러 레이어로 분해
- **전체 이해 필요**: 전체를 봐야 기능 흐름 이해 가능
- **패턴 분산**: 다른 패턴이 다른 폴더에 분산
- **Single Feature, Multiple Concerns**

## 예시

**Example 1: Elasticsearch 검색 기능 (파일 78개)**
\`\`\`
elasticsearch/
  agg/
    BookmarkCountAggregation.java
    UserStatsAggregation.java
    PostAggregation.java
  api/
    BookmarkSearch.java
    CommentSearch.java
    UserSearch.java
  document/
    BookmarkDoc.java
    CommentDoc.java
    UserDoc.java
  internal/
    BookmarkQuery.java
    CommentQuery.java
  mapper/
    BookmarkMapper.java
    UserMapper.java
  vector/
    VectorEmbedding.java
  ...
\`\`\`

**폴더별 역할:**
- agg/: 집계 로직 (*Aggregation)
- api/: 검색 파사드 (*Search)
- document/: Elasticsearch 문서 모델 (*Doc)
- internal/: 쿼리 빌더 (*Query)
- mapper/: 변환 (*Mapper)
- vector/: 벡터화

**판단 근거:**
→ 각 폴더가 서로 다른 책임 (집계, 파사드, 모델, 쿼리, 변환, 벡터)
→ "검색" 기능을 여러 레이어로 분해한 구조
→ bookmark이라는 도메인이 여러 폴더에 걸쳐 존재 (agg/BookmarkCount, api/BookmarkSearch, document/BookmarkDoc)
→ 새 기능 추가 시 여러 레이어에 걸쳐 수정 필요
→ **decomposed**

**Example 2: API Gateway (파일 30개)**
\`\`\`
gateway/
  filter/
    AuthFilter.java
    RateLimitFilter.java
    LoggingFilter.java
  router/
    RouteConfig.java
    RouteHandler.java
  transformer/
    RequestTransformer.java
    ResponseTransformer.java
  circuit-breaker/
    CircuitBreaker.java
    FallbackHandler.java
\`\`\`

**폴더별 역할:**
- filter/: 요청 필터링
- router/: 라우팅
- transformer/: 요청/응답 변환
- circuit-breaker/: 장애 처리

**판단 근거:**
→ "API Gateway" 기능을 여러 책임으로 분해
→ 각 폴더가 다른 역할과 패턴
→ **decomposed**
</decomposed>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
판단 방법
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

위의 예시들을 참고하여, 입력 데이터가 어느 쪽에 가까운지 평가하세요.

<evaluation-guide>
1. **하위 폴더의 동질성/이질성 확인**

   **Homogeneous (동질적)** → template-based
   - 각 하위 폴더가 비슷한 구조
   - 예: bookmark/, comment/, user/ 폴더 모두 Reader/Writer 포함

   **Heterogeneous (이질적)** → decomposed
   - 각 하위 폴더가 서로 다른 역할
   - 예: agg/, api/, document/, mapper/ 각각 다른 책임

2. **패턴 분포 관찰**

   **패턴 반복** → template-based
   - 같은 패턴이 여러 폴더에서 반복
   - 예: bookmark/BookmarkReader, comment/CommentReader, user/UserReader

   **패턴 분산** → decomposed
   - 다른 패턴이 다른 폴더에 분산
   - 예: agg/*Aggregation, api/*Search, document/*Doc

3. **도메인 vs 기능 영역**

   **여러 도메인** → template-based
   - User, Product, Order, Bookmark 등 비즈니스 도메인
   - 각 도메인마다 같은 패턴 적용

   **단일 기능** → decomposed
   - 검색, 캐싱, 게이트웨이, 결제 등 특정 기능
   - 기능을 여러 책임으로 분해

4. **확장 방식 추론**

   **수평 확장** → template-based
   - 새 도메인 추가 = 기존 폴더 복사 + 이름만 변경
   - 예: product 추가 시 bookmark 폴더 복사

   **수직 분해** → decomposed
   - 새 기능 추가 = 여러 레이어에 걸쳐 코드 추가
   - 예: 새 검색 기능 추가 시 agg, api, document, query 모두 수정

5. **도메인 이름의 위치**

   **폴더 이름에 도메인** → template-based
   - bookmark/, comment/, user/

   **파일 이름에 도메인** → decomposed
   - agg/BookmarkCountAggregation, api/BookmarkSearch
   - 같은 도메인(Bookmark)이 여러 폴더에 흩어져 있음

6. **예외 허용**

   template-based는 10~20% 예외 허용
   - 대다수(80~90%)가 일관된 패턴이면 OK
   - 일부 특수 파일이 있어도 template-based 가능
</evaluation-guide>

<confidence>
- 명확함: 0.9-1.0
- 대체로 맞음: 0.7-0.8
- 애매함: 0.5-0.6
</confidence>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
출력 형식
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

JSON으로 반환:
{
  "type": "template-based" | "decomposed",
  "confidence": 0.85,
  "reasoning": "구체적인 판단 근거 (2-3문장)"
}

<example-outputs>
Example 1 (template-based):
{
  "type": "template-based",
  "confidence": 0.92,
  "reasoning": "bookmark, comment, user 등 여러 도메인 폴더가 모두 동일한 *Reader/*Writer/Default* 패턴을 반복합니다. 각 하위 폴더가 동질적이며 CQRS 스타일의 전형적인 수평 확장 구조입니다."
}

Example 2 (template-based):
{
  "type": "template-based",
  "confidence": 0.90,
  "reasoning": "bookmark, comment, job 등 도메인별 폴더가 Entity/Repository/Identity 패턴을 반복합니다. 새 도메인 추가 시 기존 폴더를 복사하는 템플릿 기반 구조입니다."
}

Example 3 (decomposed):
{
  "type": "decomposed",
  "confidence": 0.88,
  "reasoning": "검색 기능을 agg(집계), api(파사드), document(모델), internal(쿼리), mapper(변환)로 분해한 구조입니다. 각 폴더가 서로 다른 책임을 가지며, 단일 기능을 여러 레이어로 수직 분해했습니다."
}

Example 4 (decomposed):
{
  "type": "decomposed",
  "confidence": 0.85,
  "reasoning": "Gateway 기능을 filter, router, transformer, circuit-breaker로 분해한 구조입니다. 도메인 반복이 아닌 기능의 수직적 분해 구조입니다."
}
</example-outputs>

위 정보를 바탕으로 주어진 구획의 구조 타입을 분류하세요.`;
}

/**
 * Build user prompt (data only)
 */
function buildUserPrompt(
  prefix: string,
  sampleFiles: FileInfo[],
  patterns: PatternAnalysisResult
): string {
  // Calculate statistics
  const fileCount = sampleFiles.filter(f => f.type === 'file').length;
  const dirCount = sampleFiles.filter(f => f.type === 'directory').length;
  const maxDepth = sampleFiles.length > 0 ? Math.max(...sampleFiles.map(f => f.depth)) : 0;

  // Analyze subdirectories
  const subdirs = analyzeSubdirectories(sampleFiles);

  return `<prefix>
${prefix}
</prefix>

<statistics>
- 총 파일 수: ${fileCount}개
- 총 디렉토리 수: ${dirCount}개
- 최대 깊이: ${maxDepth}
</statistics>

<patterns>
발견된 패턴: ${patterns.patterns.length}개

${patterns.patterns.length === 0
  ? '(패턴 없음)'
  : patterns.patterns.map((p, i) =>
      `${i+1}. ${p.name}: \`${p.pattern}\` (${p.count}회 발견)\n   ${p.description || ''}`
    ).join('\n')}
</patterns>

<subdirectories>
하위 디렉토리 구조:

${formatSubdirectories(subdirs)}
</subdirectories>

<sample-file-paths>
샘플 파일 경로 (구조 파악용):

${sampleFiles
  .filter(f => f.type === 'file')
  .slice(0, 30)
  .map(f => f.relativePath)
  .join('\n')}

${fileCount > 30 ? `\n... (${fileCount - 30}개 파일 생략)` : ''}
</sample-file-paths>`;
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
