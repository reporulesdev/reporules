import { callLLM } from '../../client/wrapper';

/**
 * Compress a guide document to 150-200 lines while preserving essential information
 */
export async function compressGuide(
  originalContent: string,
  model: string = 'gpt-5.1-2025-11-13',
  debug: boolean = false
): Promise<string> {
  const systemPrompt = buildCompressionSystemPrompt();
  const userPrompt = buildCompressionUserPrompt(originalContent);

  if (debug) {
    console.log('\n' + '='.repeat(80));
    console.log('📦 COMPRESSING GUIDE');
    console.log('='.repeat(80));
    console.log(`Original lines: ${originalContent.split('\n').length}`);
    console.log('='.repeat(80) + '\n');
  }

  const compressed = await callLLM({
    systemPrompt,
    userPrompt,
    model,
    temperature: 0.1,
    debug
  });

  if (debug) {
    console.log('✓ Compression complete');
    console.log(`  Compressed lines: ${compressed.split('\n').length}`);
    console.log('='.repeat(80) + '\n');
  }

  return compressed;
}

/**
 * Build system prompt for compression (instructions)
 */
function buildCompressionSystemPrompt(): string {
  return `# 가이드 문서 압축

1. **내용을 추가하거나 임의로 바꾸지 마세요.** 아래의 규칙에 따라서만 수정해야 합니다.

2. 당신의 목표는 **Claude Code 에이전트가 읽을 가이드를 컴팩트하게 수정**하는 작업자입니다.

3. 최종적으로 당신은 **문서의 의미는 전달되지만, 장황한 표현 혹은 줄일 수 있는 표현을 줄이는 것**이 목표입니다.

**🚨 절대 제약: 150-180줄 목표, 200줄 절대 초과 금지**
- 압축 결과가 200줄을 넘으면 안 됩니다
- 200줄을 넘을 것 같으면:
  - 우선순위 낮은 패턴 제거
  - 코드 예시를 더 줄이기 (각 3-5줄)
  - 설명을 bullet point 1줄로 축약

---

## 압축 규칙 (4가지)

### 규칙 1: 예시 코드 축약 (핵심 흐름만 유지)

**유지:**
- 클래스 선언 및 주요 애노테이션
- 핵심 의존성 필드
- 메인 메서드의 핵심 로직 흐름

**제거:**
- Import 구문
- 부가적인 private 메서드
- 로깅, 검증, 메트릭 등 부가 코드
- Helper 메서드들

**변경 전:**
\`\`\`java
@Component
@RequiredArgsConstructor
public class JobSearch {
    private final SearchQueryExecutor executor;
    private final JobDocMapper mapper;
    private final MetricsRecorder metricsRecorder;

    public JobSearchResult search(SearchCommand<JobIndexField> command) {
        validateCommand(command);
        metricsRecorder.record("search_start");
        var query = GenericSearchQueryBuilder.build(command, registry);
        var result = executor.search(JOB_INDEX, query, mapper);
        logSearchResult(result);
        return new JobSearchResult(result.data(), result.hasNext());
    }

    private void validateCommand(SearchCommand cmd) {
        if (cmd == null) throw new IllegalArgumentException();
    }

    private void logSearchResult(SearchResult result) {
        log.info("Found {} results", result.size());
    }
}
\`\`\`

**변경 후:**
\`\`\`java
@Component
@RequiredArgsConstructor
public class JobSearch {
    private final SearchQueryExecutor executor;

    public JobSearchResult search(SearchCommand<JobIndexField> command) {
        var query = GenericSearchQueryBuilder.build(command, registry);
        var result = executor.search(JOB_INDEX, query, mapper);
        return new JobSearchResult(result.data(), result.hasNext());
    }
}
\`\`\`

---

### 규칙 2: 패턴 개수 감축 (우선순위 기반)

**우선순위:**
1. 진입점 패턴 (Controller, Service, Handler, API)
2. 핵심 비즈니스 로직 (Repository, Executor, Search)
3. 데이터 모델 (Entity, DTO, Doc)

**제거 대상:**
- Infrastructure 패턴 (Config, Utils, Abstract*, Registry, Builder)
- 선택적 패턴 (Validator, Converter, Mapper - 핵심 아닌 경우)

**예:**
- 변경 전: 8개 패턴 (*Doc, *Mapper, *Search, *Indexer, *Aggregator, *Config, *Registry, *Executor)
- 변경 후: 4개 패턴 (*Doc, *Mapper, *Search, *Indexer)

---

### 규칙 3: 설명 축약 (레퍼런스만)

**변경 방침:**
- 장황한 설명 → Bullet point
- "왜" 설명 → 제거
- "어떻게" 설명 → 제거
- "무엇" 만 남김

**변경 전:**
\`\`\`
**규칙**:
- \`@RestController\` 애노테이션을 사용하여 이 클래스가 REST API 컨트롤러임을 Spring Framework에 알립니다
- \`ResponseEntity<T>\`를 반환 타입으로 사용하여 HTTP 상태 코드와 응답 본문을 명확하게 제어할 수 있습니다
- \`@Valid\`와 \`@RequestBody\`를 함께 사용하여 들어오는 요청 데이터의 유효성을 자동으로 검증합니다
\`\`\`

**변경 후:**
\`\`\`
**규칙**:
- \`@RestController\` 필수
- \`ResponseEntity<T>\` 반환
- \`@Valid\` + \`@RequestBody\`로 검증
\`\`\`

---

### 규칙 4: Directory Structure 중복 제거

**제거 대상:**
- 같은 패턴이 반복되는 도메인별 파일들
- 도메인/항목명만 다른 동일 구조

**표현 방법:**
- 플레이스홀더 사용: \`{domain}\`, \`{Domain}\`, \`{Action}\`
- 주석으로 나머지 명시: \`// bookmark, comment, job 등 동일\`

**변경 전:**
\`\`\`
api/
  bookmark/
    BookmarkApiController.java
    dto/
      BookmarkRequest.java
      BookmarkResponse.java
  comment/
    CommentApiController.java
    dto/
      CommentRequest.java
      CommentResponse.java
  job/
    JobApiController.java
    dto/
      JobRequest.java
      JobResponse.java
\`\`\`

**변경 후:**
\`\`\`
api/
  {domain}/                        # bookmark, comment, job 등
    {Domain}ApiController.java
    dto/
      {Action}Request.java
      {Domain}Response.java
\`\`\`

---

## 제약사항

- ✅ **문서 구조 유지**: 섹션 제목 (## Examples, ## Conventions 등) 그대로 유지
- ✅ **Frontmatter 유지**: \`---\\npaths:\\n...\` 제거 금지
- ✅ **패턴 우선순위**: 패턴이 많으면 → 우선순위 높은 것만 선택
- ✅ **실행 가능성**: 압축 후에도 개발자가 패턴 따라 코드 작성 가능해야 함
- ❌ **내용 추가 금지**: 원본에 없던 예시, 설명 추가 금지
- ❌ **의미 변경 금지**: 기술적 내용의 의미 변경 금지
- 🚨 **200줄 제약이 최우선**: 패턴 완전성보다 200줄 제약을 우선 준수

---

## 목표 출력

- **총 라인수**: 🚨 **200줄 이하 필수** (150줄 목표, 절대 200줄 초과 금지)
- **형식**: 유효한 Markdown
- **각 예시 코드**: 3-5줄 이내 (10줄 절대 금지)
- **완성도**: 핵심 패턴만 포함, 200줄 제약 우선

압축된 문서만 출력하세요. 다른 설명은 필요 없습니다.`;
}

/**
 * Build user prompt for compression (data only)
 */
function buildCompressionUserPrompt(originalContent: string): string {
  const lineCount = originalContent.split('\n').length;
  return `아래 문서를 압축하세요 (현재 ${lineCount}줄 → 목표 150-200줄):

${originalContent}`;
}
