import { callLLM } from '../../client/wrapper';
import { PreliminaryAnalysisResult, RuleGenerationResult, SampleFile, PatternAnalysisResult, FileInfo } from '../../data/types';
import { ProjectTree } from '../projectTree';
import { PrefixStructureType } from './classifyPrefixStructure';
import { compressGuide } from './compressGuide';

/**
 * Classification info for rule generation
 */
export interface RuleClassification {
  structured: boolean;
  type?: PrefixStructureType; // 'template-based' | 'decomposed'
}

/**
 * Step 3-3: Generate Rules for a Prefix
 *
 * Generates coding rules document based on RULE_TEMPLATE.md format
 * Returns null for Flat modules (no custom rules needed, use global rules only)
 */
export async function generateRules(
  prefix: string,
  projectTree: ProjectTree,
  sampleFiles: SampleFile[],
  patterns: PatternAnalysisResult,
  prelimResult: PreliminaryAnalysisResult,
  classification?: RuleClassification,
  model: string = 'gpt-5.1-2025-11-13',
  debug: boolean = false,
  experimental: boolean = false
): Promise<RuleGenerationResult | null> {
  // Validate: must have sample files
  if (sampleFiles.length === 0) {
    throw new Error(`Cannot generate rules for prefix "${prefix}": No sample files provided. This usually means the path doesn't exist or has no files.`);
  }

  // Skip rule generation for Flat modules (use global rules only)
  if (classification && !classification.structured) {
    if (debug) {
      console.log(`⏭️  Skipping rule generation for flat module: ${prefix}`);
      console.log(`   → This module will follow global/common rules only`);
    }
    return null;
  }

  // Branch by classification type
  if (experimental) {
    // EXPERIMENTAL: Always use new GPT-5.1 style prompt
    if (debug) {
      console.log('🧪 [EXPERIMENTAL] Using new GPT-5.1 style prompt');
    }
    return generateRulesExperimental(prefix, projectTree, sampleFiles, patterns, prelimResult, model, debug);
  } else if (classification?.type === 'decomposed') {
    // Use meta-prompt approach (2-step)
    return generateRulesForMetaPrompt(prefix, projectTree, sampleFiles, patterns, prelimResult, model, debug);
  } else {
    // Template-based (default) - use OLD prompt
    return generateRulesForTemplateBased(prefix, projectTree, sampleFiles, patterns, prelimResult, model, debug);
  }
}

/**
 * Build system prompt for template-based rules generation (OLD prompt)
 */
function buildTemplateBasedSystemPrompt(
  prefix: string,
  patterns: PatternAnalysisResult,
  prelimResult: PreliminaryAnalysisResult,
  projectTree: ProjectTree
): string {
  // Get file statistics for this prefix
  const prefixFiles = projectTree.pickByPrefix(prefix);
  const fileCount = prefixFiles.filter(f => f.type === 'file').length;

  // Determine display name for prefix
  const displayName = prefix === '' ? 'Global' : prefix.replace(/\/$/, '');

  return `You are an expert software architect creating coding rules. Respond with a well-structured markdown document.

<goal>
구획에 대한 코딩 가이드를 생성합니다.

이 문서는 개발자가 이 구획에서 작업할 때 참고할 레퍼런스입니다.
RULE_TEMPLATE.md 형식을 따라 작성하세요.

제약사항:
- 전체 문서는 100-200줄 이내로 간결하게
- 예시 코드는 패턴의 "모양"만 보여주기 (모든 필드 포함 X)
- 각 패턴당 예시 1개만
- **패턴은 최대 10개 이내로 제한** (10개 이상이면 문서가 너무 길고 혼란스러움)
</goal>

<pattern-selection-guide>
발견된 패턴이 12개 이상인 경우, 다음 우선순위에 따라 **핵심 패턴 최대 12개만 선별**하세요:

1. **진입점 패턴** (Controller, Service, Handler, Search, API 등) - 개발자가 가장 자주 만드는 파일
2. **핵심 비즈니스 로직 패턴** (Repository, Manager, Executor, Processor 등)
3. **데이터 모델 패턴** (Entity, DTO, Doc, Command, Result 등)
4. **인프라/설정 패턴** (Config, Client, Utils 등) - 최소화

**패턴 통합 전략**:
- 유사한 유틸리티 패턴은 하나로 통합 (Utils, Helper, Converter → "Utilities" 하나로)
- 테스트 패턴은 2개로 통합 (*.test.ts, *.e2e.test.ts → 하나로 설명)
- Exception은 별도 패턴으로 나열하지 말고 Conventions에서 간단히 언급
- Registry 계열은 하나로 통합

최종 Pattern Overview에는 **선별된 핵심 패턴만** 나열하세요.
</pattern-selection-guide>

<output-format>
다음 형식을 **정확히** 따라 마크다운 문서를 생성하세요:

\`\`\`markdown
---
paths:
  - "${prefix}**/*"
---

# ${displayName} Guide

## 📖 이 문서에 대하여

이 문서는 **${displayName} 모듈에서 작업할 때 참고할 가이드**입니다.

이 모듈의 코드는 아래의 특정 패턴 형태로 작성하는 것이 권장됩니다.

개발할 때, 아래 패턴을 참고해서 사용자 요청 기능을 만들되, **억지로 패턴을 따르지 않아도 됩니다**.

개발 구조를 설계할 때 참고할 레퍼런스입니다.

실제 각 패턴의 내용을 개발할 때는, **각 경로의 rules도 참고**해서 개발하시오.

---

## Pattern Overview

이 모듈에서 발견된 패턴:
${patterns.patterns.length === 0
    ? '- (발견된 반복 패턴 없음)'
    : patterns.patterns.length > 10
      ? '- [발견된 패턴에서 핵심 패턴 12개 이내만 선별하여 나열]'
      : '[패턴 리스트를 사용자가 제공한 데이터에서 작성]'}

---

## Examples

[각 패턴별 예시 코드 작성]

---

## Conventions

### Naming
[네이밍 규칙 작성]

### Directory Structure (권장)
\`\`\`
[간소화된 디렉토리 구조 작성]
\`\`\`
\`\`\`
</output-format>

<instructions>
1. "📖 이 문서에 대하여" 섹션은 위 템플릿 그대로 사용
2. Pattern Overview: patterns 리스트를 bullet list로 간단히
3. Examples:
   - 각 패턴당 5-10줄만
   - 클래스/함수의 시그니처만 보여주기
   - 모든 필드를 나열하지 말 것
   - // 주석으로 ... 처리 가능
   - **반드시 샘플 파일의 실제 코드를 기반으로 작성** (임의의 예시 금지)
4. Conventions: 네이밍 규칙 + 디렉토리 구조 (간단히)
5. Directory Structure:
   - **매우 간소화된 트리 뷰**로 작성
   - 각 패턴당 대표 파일 **1개만** 표시
   - 같은 패턴의 여러 파일을 모두 나열하지 말 것
   - 예: UserEntity.java 보여줬으면, ProductEntity.java, OrderEntity.java 등은 생략
   - 구조의 계층만 보여주는 것이 목적
6. 전체 100-150줄 이내로 작성
7. 패턴이 없는 경우: 샘플 파일에서 관찰된 일반적인 코딩 스타일/컨벤션만 설명
</instructions>

<example-of-brief-code>
좋은 예시 (간략):
\`\`\`java
@Table("users")
@Getter
public class UserEntity {
    @Id private Long id;
    private String email;
    // ... other fields
}
\`\`\`

나쁜 예시 (너무 상세):
\`\`\`java
@Table("users")
@Getter
@AllArgsConstructor
public class UserEntity {
    @Id private Long id;
    private String email;
    private String nickname;
    private String profileImage;
    private UserRole role;
    private Instant createdAt;
    private Instant updatedAt;
    // ... 모든 필드를 다 나열
}
\`\`\`
</example-of-brief-code>

<example-of-directory-structure>
좋은 예시 (간소화):
\`\`\`
modules/devrunner/service/
  bookmark/
    BookmarkReader.java       # 패턴 대표
    impl/
      DefaultBookmarkReader.java
  comment/
    CommentReader.java
    CommentWriter.java
    dto/
      CommentWriteCommand.java
    impl/
      DefaultCommentReader.java
  // ... (다른 도메인도 동일 패턴)
\`\`\`

나쁜 예시 (모든 파일 나열):
\`\`\`
modules/devrunner/service/
  bookmark/
    BookmarkReader.java
    BookmarkWriter.java
    impl/
      DefaultBookmarkReader.java
      DefaultBookmarkWriter.java
  comment/
    CommentReader.java
    CommentWriter.java
    dto/
      CommentWriteCommand.java
    impl/
      DefaultCommentReader.java
      DefaultCommentWriter.java
  // ... (너무 많은 파일)
\`\`\`
</example-of-directory-structure>

위 템플릿을 따라 제공된 데이터를 바탕으로 간결한 가이드 문서를 생성하세요.`;
}

/**
 * Build system prompt for experimental rules generation (NEW GPT-5.1 prompt)
 */
function buildExperimentalSystemPrompt(
  prefix: string,
  patterns: PatternAnalysisResult,
  prelimResult: PreliminaryAnalysisResult,
  projectTree: ProjectTree
): string {
  // Get file statistics for this prefix
  const prefixFiles = projectTree.pickByPrefix(prefix);
  const fileCount = prefixFiles.filter(f => f.type === 'file').length;

  // Determine display name for prefix
  const displayName = prefix === '' ? 'Global' : prefix.replace(/\/$/, '');

  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
목적
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

당신은 **${displayName} 모듈의 코딩 가이드 문서**를 작성합니다.

주어진 샘플 코드와 패턴 정보를 분석하여,
개발자(AI 에이전트)가 이 모듈의 코드를 생성할 때 필요한 실용적 가이드를 작성하세요.

**제약:** 전체 100-200줄 (150줄 목표)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<패턴파악>
1. 패턴을 파악하세요. 아래가 패턴에 해당합니다.
   - "코드의 생성에 필요한 파일과 해당 구조간의 연관 관계"
   - 반복되는 스타일, 제약사항
   - 에이전트가 해당 코딩 스타일을 재현하기 위해 필요한 정보

2. 파악한 패턴이 해당 언어, 프레임워크에서 공통적으로 적용해야 하는 사실일 경우, 명시하지 않아도 될 경우 제외하시오.

3. 같은 패턴, 통상적으로 같은 패턴으로 보여질 수 있는 사실은 중요한 것 하나만 사용하시오.

4. "에이전트가 해당 모듈 코드 제작에 필요한 규칙인가"에 대한 관점으로 중요도를 상, 중, 하로 평가하시오.
</패턴파악>

<패턴 서술 방법 설계>
위에서 파악한 패턴에 대해 아래 구분에 따라 서술 방법을 계획하시오.

1. 서술이 필요한 제약사항, 혹은 구성요소와의 관계를 설명해야 하는 경우, 1~2개의 문장으로 정리하여 서술하시오. 그리고 예시를 첨부하시오.

2. 간단한 예시만으로 서술이 가능한 경우, 규칙에 대한 네이밍과 간단한 예시만을 첨부하시오.
</패턴 서술 방법 설계>

<예시 서술 방법>
1. 기본적으로 패턴을 서술하는데 필요한 요소만을 서술합니다. (변수의 선언, import) 등은 추가하지 않습니다.

2. 코드의 패턴, 다른 함수, 클래스와의 관계를 보여주는 부분을 제외하면 생략하시오.
</예시 서술 방법>

<작성 규칙>
1. 아래의 예시파일의 형식으로 출력하시오.

2. **생성된 결과물의 총 라인수는 반드시 200줄 이하여야 합니다.**
   - 출력 전 반드시 확인: 전체 라인수가 200줄 이하인가?
   - 200줄 초과 시: 중요도가 낮은 패턴순으로 제거하시오.
   - 각 예시 코드는 10-15줄 이하로 제한하시오.
   - 패턴 개수는 3-6개로 제한하시오.
</작성 규칙>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<출력형식>
다음 형식을 정확히 따라 작성하세요:

\`\`\`markdown
---
paths:
  - "${prefix}**/*"
---

# ${displayName} Guide

## 📖 이 문서에 대하여

이 문서는 **${displayName} 모듈에서 작업할 때 참고할 가이드**입니다.

이 모듈의 코드는 아래의 특정 패턴 형태로 작성하는 것이 권장됩니다.

개발할 때, 아래 패턴을 참고해서 사용자 요청 기능을 만들되, **억지로 패턴을 따르지 않아도 됩니다**.

개발 구조를 설계할 때 참고할 레퍼런스입니다.

실제 각 패턴의 내용을 개발할 때는, **각 경로의 rules도 참고**해서 개발하시오.

---

## Pattern Overview

이 모듈에서 발견된 패턴:

- **PatternName1** - 간단한 설명 (1줄)
- **PatternName2** - 간단한 설명 (1줄)
...

---

## Examples

### 1. PatternName1

필요한 요소만 간결하게

---

## Conventions

### Naming
- 네이밍 규칙

### Directory Structure (권장)
간소화된 디렉토리 구조
\`\`\`
</출력형식>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
입력
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

아래 입력 데이터를 분석하여 위 규칙에 따라 가이드 문서를 작성하세요.
`;
}

/**
 * Build meta-prompt for decomposed rules generation
 */
function buildMetaPrompt(): string {
  return `# Meta-Prompt: 모듈 가이드 생성 프롬프트 작성

## 1. 당신의 역할

당신은 **메타 프롬프트를 작성**해야 합니다.

당신은 소프트웨어 아키텍처 전문가로서, 프로젝트의 모듈 구조를 분석하여 **가이드 문서를 생성하는 프롬프트(메타 프롬프트)**를 작성하는 역할입니다.

---

## 2. 메타 프롬프트의 목적

당신이 작성할 프롬프트를 **"메타 프롬프트"**라고 칭합니다.

메타 프롬프트는 다음을 수행해야 합니다:
- 입력: 모듈의 tree 구조, 샘플 코드, 패턴 정보
- 출력: 개발자가 새로운 도메인을 추가할 때 참고할 **가이드 문서** (200줄 이하)

**메타 프롬프트의 핵심 기능**:
1. 모듈의 메인 기능 파악 ("새로운 [무엇]을 추가할 때")
2. Feature 패턴과 Infrastructure 패턴 구분
3. Feature 패턴만 선택하여 가이드 작성 (3-6개)
4. 각 패턴의 코드 예시와 규칙 추출

---

## 3. 메타 프롬프트 수행의 결과물

메타 프롬프트를 실행하면, 아래와 같은 **가이드 문서**가 생성되어야 합니다.

## 예시: elasticsearch 모듈

### 구조
\`\`\`markdown
---
paths:
  - "modules/devrunner/elasticsearch/**/*"
---

# elasticsearch Guide

## 📖 이 문서에 대하여
이 문서는 **elasticsearch 모듈에서 새로운 도메인의 검색 기능을 추가할 때** 참고할 가이드입니다.

## 🎯 메인 기능
**"새로운 도메인의 검색 기능 추가"** (예: Job 검색, TechBlog 검색)

## 📁 필수 패턴 (6개)
새 도메인 검색을 추가할 때 반드시 만들어야 하는 파일:

\\\`\\\`\\\`
elasticsearch/
  document/
    {Domain}Doc.java                               # ES 문서 정의
  document/fieldSpec/{domain}/
    {Domain}IndexField.java                        # 검색 가능 필드 enum
  mapper/
    {Domain}DocMapper.java                         # 도메인 모델 → Doc 변환
  api/{domain}/
    {Domain}Search.java                            # 검색 서비스
    {Domain}Indexer.java                           # 문서 색인
  internal/query/{domain}/
    {Domain}IndexQueryBuilderRegistry.java         # TERM/MATCH 쿼리 전략
\\\`\\\`\\\`

## 💡 Examples

### 1. {Domain}Doc Pattern

\\\`\\\`\\\`java
@Value
@JsonInclude(JsonInclude.Include.NON_NULL)
public class JobDoc implements DocBase {
    @JsonProperty("doc_id") String docId;           // "job_{id}" 패턴
    @JsonProperty("job_id") Long jobId;
    @JsonProperty("title") String title;
    @JsonProperty("deleted") Boolean deleted;       // 필수!
    @JsonProperty("created_at") Long createdAt;     // epoch_millis
}
\\\`\\\`\\\`

**규칙**:
- docId는 \\\`"{type}_{id}"\\\` 패턴 (필수)
- 중첩 객체는 평탄화
- 날짜는 epoch_millis (Long)
- deleted 필드 필수

### 2. {Domain}Search Pattern

\\\`\\\`\\\`java
@Component
@RequiredArgsConstructor
public class JobSearch {
    private final SearchQueryExecutor executor;

    public JobSearchResult search(SearchCommand<JobIndexField> command) {
        var query = GenericSearchQueryBuilder.build(command, ...);
        var result = executor.search(JOB_INDEX, query, ...);
        return new JobSearchResult(result.data(), result.hasNext());
    }
}
\\\`\\\`\\\`

**규칙**:
- \\\`SearchCommand<{Domain}IndexField>\\\` 입력
- \\\`GenericSearchQueryBuilder\\\` + Registry로 쿼리 생성

## ⚠️ 중요 규칙

### Doc 작성 규칙
- docId는 \\\`"{type}_{id}"\\\` 패턴 **필수**
- 중첩 객체는 **평탄화** (ES 성능 최적화)
- 날짜는 **epoch_millis** (Long)
- **deleted 필드 필수** (검색 시 기본 필터)

### Search 작업 시
- deleted=false 조건 자동 추가 권장
- MATCH 쿼리 있으면 relevance 정렬
\`\`\`

---

## 예시: api 모듈

### 구조
\`\`\`markdown
---
paths:
  - "modules/apis/api/**/*"
---

# api Guide

## 📖 이 문서에 대하여
이 문서는 **api 모듈에서 새로운 도메인의 REST API를 추가할 때** 참고할 가이드입니다.

## 🎯 메인 기능
**"새로운 도메인의 REST API 추가"** (예: Bookmark API, Job API)

## 📁 필수 패턴 (3개)
새 도메인 REST API를 추가할 때 만들어야 하는 파일:

\\\`\\\`\\\`
api/
  {domain}/
    {Domain}ApiController.java        # REST API 컨트롤러
    dto/
      {Action}Request.java             # 요청 DTO
      {Domain}Response.java            # 응답 DTO
\\\`\\\`\\\`

## 💡 Examples

### 1. {Domain}ApiController Pattern

\\\`\\\`\\\`java
@RestController
@RequestMapping("/api/bookmarks")
@RequiredArgsConstructor
public class BookmarkApiController {
    private final BookmarkWriter bookmarkWriter;

    @PostMapping
    public ResponseEntity<Void> addBookmark(
        @AuthenticationPrincipal SessionUser sessionUser,
        @Valid @RequestBody BookmarkRequest request
    ) {
        var userId = readUserIdOrThrow(sessionUser);
        bookmarkWriter.add(userId, request.getTargetType(), request.getTargetId());
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }
}
\\\`\\\`\\\`

**규칙**:
- \\\`@RestController\\\` + \\\`@RequestMapping\\\` 필수
- \\\`@Valid\\\` + \\\`@RequestBody\\\`로 요청 검증
- \\\`ResponseEntity<T>\\\` 반환, HTTP Status 명시

### 2. Request DTO Pattern

\\\`\\\`\\\`java
@Getter
@NoArgsConstructor
public class BookmarkRequest {
    @NotNull(message = "targetType is required")
    private TargetType targetType;

    @NotNull(message = "targetId is required")
    private Long targetId;
}
\\\`\\\`\\\`

**규칙**:
- \\\`@Getter\\\` + \\\`@NoArgsConstructor\\\` 필수
- \\\`jakarta.validation\\\` 애노테이션 적극 사용
- 필드는 \\\`private\\\`, setter 없음 (불변 지향)

## ⚠️ 중요 규칙

### Controller 작성 규칙
- \\\`@Valid\\\` + \\\`@RequestBody\\\`로 요청 검증 필수
- \\\`ResponseEntity<T>\\\` 반환, HTTP Status 명시
- 비즈니스 로직은 Service 계층에 위임

### DTO 작성 규칙
- Request: \\\`@NotNull\\\`, \\\`@NotBlank\\\` 등 validation 필수
- Response: 정적 팩토리 메서드로 생성
- 불변 객체 지향 (setter 없음)
\`\`\`

---

## 4. 메타 프롬프트가 받을 입력 데이터

메타 프롬프트는 다음 형식의 데이터를 입력으로 받습니다:

\`\`\`json
{
  "prefix": "modules/devrunner/elasticsearch",
  "tree": "elasticsearch/\\n  document/\\n    JobDoc.java\\n    TechBlogDoc.java\\n  ...",
  "samples": [
    {
      "path": "document/JobDoc.java",
      "content": "@Value\\npublic class JobDoc { ... }"
    },
    {
      "path": "api/job/JobSearch.java",
      "content": "@Component\\npublic class JobSearch { ... }"
    }
  ],
  "patterns": {
    "detected": ["*Doc", "*Search", "*Indexer", "*Aggregator"],
    "repeating": ["Job*", "TechBlog*", "CommunityPost*"]
  }
}
\`\`\`

---

## 5. 제약사항 및 요구사항

당신이 작성할 메타 프롬프트는 다음 조건을 만족해야 합니다:

### 메타 프롬프트 자체의 요구사항:
1. 입력 데이터(tree, samples, patterns)를 분석하는 명확한 지침 제공
2. Feature vs Infrastructure 패턴을 구분하는 방법 설명
3. 메인 기능을 식별하는 방법 제시
4. 출력 형식을 명확히 정의

### 메타 프롬프트가 생성하는 가이드 문서의 제약사항:
1. **길이**: 200줄 이하 (엄격히 준수)
2. **구조**:
   - 메인 기능 (1개, "새로운 [무엇] 추가" 형식)
   - 필수 패턴 (3-6개, Feature 패턴만)
   - Examples (필수 패턴당 1개씩)
   - 중요 규칙
3. **제외**: Infrastructure 패턴 (Generic*, Multi*, Abstract*, *Executor, *Config 등)
4. **포함**: Feature 패턴 (도메인마다 만드는 것: Job*, TechBlog* 등)

### 메타 프롬프트가 수행해야 하는 작업:
1. **메인 기능 식별**: tree와 samples를 보고 "이 모듈의 메인 기능"을 파악
2. **Feature vs Infrastructure 구분**:
   - Feature: 도메인마다 반복 (Job*, TechBlog*)
   - Infrastructure: 공통 사용 (Multi*, Generic*, Abstract*)
3. **필수 패턴 추출**: Feature 패턴 3-6개만 선택
4. **가이드 생성**: 위 예시와 동일한 형식으로 200줄 이내

---

## 5.5 ⚠️ 간결성 제어 (엄격 준수)

**생성된 결과물의 총 라인수는 반드시 200줄 이하여야 합니다.**

이 제약을 지키기 위해 아래 규칙을 **엄격히** 적용하시오:

### 1. 예시 코드는 핵심 구조만 표현
- ❌ **잘못된 예**: 모든 필드를 다 나열 (50+ 줄)
  \`\`\`java
  return new JobDoc(
      doc.getDocId(),
      doc.getJobId(),
      doc.getUrl(),
      doc.getCompany(),
      doc.getTitle(),
      // ... 50개 필드 계속 나열
  );
  \`\`\`
- ✅ **올바른 예**: 핵심 필드만 + 생략 표시 (10줄 이하)
  \`\`\`java
  return new JobDoc(
      generateDocId(job),
      job.getJobId(),
      job.getTitle(),
      // ... other fields (중첩 객체 평탄화, 날짜 변환 등)
      vector
  );
  \`\`\`

### 2. 패턴 수 제한
- 패턴이 10개 이상 발견되더라도, **메인 로직 흐름에 핵심인 것만 3-6개로 압축**
- 우선순위:
  1. 진입점 패턴 (Controller, Service, Handler, API 등)
  2. 핵심 비즈니스 로직 (Repository, Manager, Executor 등)
  3. 데이터 모델 (Entity, DTO, Doc 등)
  4. 인프라/설정은 **최소화하거나 제외** (Config, Utils, Abstract* 등)

### 3. Directory Structure는 대표 파일만
- ❌ **잘못된 예**: 모든 도메인의 모든 파일 나열
  \`\`\`
  api/
    bookmark/
      BookmarkApiController.java
    comment/
      CommentApiController.java
    job/
      JobApiController.java
    // ... 20개 더
  \`\`\`
- ✅ **올바른 예**: 패턴을 보여주는 대표 파일 1개만
  \`\`\`
  api/
    {domain}/
      {Domain}ApiController.java
      dto/
        {Action}Request.java
    // 나머지 도메인도 동일 패턴
  \`\`\`

### 4. 규칙 설명은 bullet point로 간결하게
- 각 패턴당 규칙은 3-5개 bullet point로 제한
- 장황한 설명 금지, 핵심만 명시
- 예: "docId는 \\\`{type}_{id}\\\` 패턴 (필수)" ✅
- 아닌 예: "docId 필드는 Elasticsearch에서 문서를 고유하게 식별하기 위한 ID로, 이 프로젝트에서는 \\\`{type}_{id}\\\` 형식을 사용하며..." ❌

### 5. 중복 제거
- 같은 내용이 Examples와 "중요 규칙" 섹션에 반복되지 않도록
- 한 곳에서 설명했으면 다른 곳에서는 간단히 참조만

**최종 체크리스트 (출력 전 반드시 확인):**
- [ ] 전체 라인수가 200줄 이하인가?
- [ ] 각 예시 코드가 10-15줄 이하인가?
- [ ] 패턴 개수가 3-6개인가?
- [ ] Directory Structure가 간소화되어 있는가?
- [ ] 불필요한 중복이 제거되었는가?

---

## 6. 출력

위 조건을 만족하는 **메타 프롬프트**를 작성하세요.
`;
}

/**
 * Build user prompt for template-based rules generation (data only)
 */
function buildTemplateBasedUserPrompt(
  sampleFiles: SampleFile[],
  patterns: PatternAnalysisResult
): string {
  return `<patterns>
${patterns.patterns.length === 0
    ? '발견된 반복 패턴 없음 (패턴 없는 구조)'
    : patterns.patterns.map((p, i) =>
        `${i + 1}. ${p.name} (${p.pattern}): ${p.count}회 발견\n   ${p.description || ''}`
      ).join('\n')}
</patterns>

<sample-files>
${formatSampleFiles(sampleFiles)}
</sample-files>`;
}

/**
 * Format sample files for prompt
 */
function formatSampleFiles(sampleFiles: SampleFile[]): string {
  if (sampleFiles.length === 0) {
    return '(No sample files provided)';
  }

  let result = '';
  sampleFiles.forEach((file, index) => {
    result += `<file-${index + 1}>\n`;
    result += `Path: ${file.path}\n`;
    result += `Lines: ${file.lines}\n\n`;
    result += `--- Content ---\n`;
    result += file.content + '\n';
    result += `</file-${index + 1}>\n\n`;
  });
  return result;
}

/**
 * Generate rules for Template-based structure (OLD prompt)
 */
async function generateRulesForTemplateBased(
  prefix: string,
  projectTree: ProjectTree,
  sampleFiles: SampleFile[],
  patterns: PatternAnalysisResult,
  prelimResult: PreliminaryAnalysisResult,
  model: string,
  debug: boolean
): Promise<RuleGenerationResult> {
  // Build prompts
  const systemPrompt = buildTemplateBasedSystemPrompt(prefix, patterns, prelimResult, projectTree);
  const userPrompt = buildTemplateBasedUserPrompt(sampleFiles, patterns);

  // Debug: Print prompt if requested
  if (debug) {
    console.log('\n' + '='.repeat(80));
    console.log('📝 GENERATE RULES PROMPT (TEMPLATE-BASED)');
    console.log('='.repeat(80));
    console.log('SYSTEM:\n', systemPrompt.substring(0, 500) + '...');
    console.log('\nUSER:\n', userPrompt.substring(0, 500) + '...');
    console.log('='.repeat(80) + '\n');
  }

  // Call LLM
  let content = await callLLM({
    systemPrompt,
    userPrompt,
    model,
    temperature: 0.2,
    debug
  });

  // Post-process: Compress guide
  content = await compressGuide(content, model, debug);

  return {
    prefix,
    content,
  };
}

/**
 * Generate rules using EXPERIMENTAL GPT-5.1 style prompt (NEW)
 */
async function generateRulesExperimental(
  prefix: string,
  projectTree: ProjectTree,
  sampleFiles: SampleFile[],
  patterns: PatternAnalysisResult,
  prelimResult: PreliminaryAnalysisResult,
  model: string,
  debug: boolean
): Promise<RuleGenerationResult> {
  // Build prompts
  const systemPrompt = buildExperimentalSystemPrompt(prefix, patterns, prelimResult, projectTree);
  const userPrompt = buildTemplateBasedUserPrompt(sampleFiles, patterns);

  // Debug: Print prompt if requested
  if (debug) {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 GENERATE RULES PROMPT (EXPERIMENTAL - GPT-5.1 STYLE)');
    console.log('='.repeat(80));
    console.log('SYSTEM:\n', systemPrompt.substring(0, 500) + '...');
    console.log('\nUSER:\n', userPrompt.substring(0, 500) + '...');
    console.log('='.repeat(80) + '\n');
  }

  // Call LLM
  let content = await callLLM({
    systemPrompt,
    userPrompt,
    model,
    temperature: 0.2,
    debug
  });

  // Post-process: Compress guide
  content = await compressGuide(content, model, debug);

  return {
    prefix,
    content,
  };
}

/**
 * Step 1: Generate meta-prompt from project data
 */
async function callMetaPromptGeneration(
  metaPrompt: string,
  dataPrompt: string,
  model: string,
  debug: boolean
): Promise<string> {
  if (debug) {
    console.log('📝 Step 1/2: Generating Meta-Prompt');
    console.log('-'.repeat(80));
    console.log('Using meta-prompt.md as system prompt...');
    console.log('-'.repeat(80) + '\n');
  }

  const generatedPrompt = await callLLM({
    systemPrompt: metaPrompt,
    userPrompt: dataPrompt + '\n\n위 데이터를 기반으로 가이드 문서 생성용 메타 프롬프트를 작성하세요.',
    model,
    temperature: 0.2,
    debug
  });

  if (debug) {
    console.log('✓ Meta-Prompt Generated');
    console.log('-'.repeat(80));
    console.log(generatedPrompt.substring(0, 500) + '...');
    console.log('-'.repeat(80) + '\n');
  }

  return generatedPrompt;
}

/**
 * Step 2: Generate guide document from meta-prompt
 */
async function callGuideDocumentGeneration(
  generatedPrompt: string,
  dataPrompt: string,
  model: string,
  debug: boolean
): Promise<string> {
  if (debug) {
    console.log('📝 Step 2/2: Generating Guide Document');
    console.log('-'.repeat(80));
    console.log('Using generated meta-prompt as system prompt...');
    console.log('-'.repeat(80) + '\n');
  }

  const content = await callLLM({
    systemPrompt: generatedPrompt,
    userPrompt: dataPrompt + '\n\n위 입력 데이터를 분석하여 가이드 문서를 생성하세요.',
    model,
    temperature: 0.2,
    debug
  });

  if (debug) {
    console.log('✓ Guide Document Generated');
    console.log('='.repeat(80) + '\n');
  }

  return content;
}

/**
 * Generate rules using meta-prompt approach (2-step)
 *
 * Step 1: Use meta-prompt.md to generate a custom prompt for guide creation
 * Step 2: Use the generated prompt to create the actual guide document
 */
async function generateRulesForMetaPrompt(
  prefix: string,
  projectTree: ProjectTree,
  sampleFiles: SampleFile[],
  patterns: PatternAnalysisResult,
  prelimResult: PreliminaryAnalysisResult,
  model: string,
  debug: boolean
): Promise<RuleGenerationResult> {

  if (debug) {
    console.log('\n' + '='.repeat(80));
    console.log('📝 GENERATE RULES (META-PROMPT - 2 STEPS)');
    console.log('='.repeat(80) + '\n');
  }

  // Use meta-prompt string constant
  const metaPrompt = buildMetaPrompt();

  // Build input data (same format as test-meta-prompt.test.ts)
  const prefixFiles = projectTree.pickByPrefix(prefix);
  const fileCount = prefixFiles.filter(f => f.type === 'file').length;

  // Build tree string for this prefix
  const treeString = prefixFiles
    .map(f => {
      const indent = '  '.repeat(f.depth - 1);
      return `${indent}${f.name}${f.type === 'directory' ? '/' : ''}`;
    })
    .join('\n');

  // Format sample files
  const samplesText = sampleFiles
    .map(s => `<file>
Path: ${s.path}
Lines: ${s.lines}

--- Content ---
${s.content}
</file>`)
    .join('\n\n');

  // Format patterns
  const patternsText = patterns.patterns.length === 0
    ? '(No patterns detected)'
    : patterns.patterns.map(p =>
        `- ${p.pattern}: ${p.description} (${p.count}회 발견)`
      ).join('\n');

  const dataPrompt = `<prefix>
${prefix}
</prefix>

<tree>
${treeString}
</tree>

<statistics>
- 총 파일 수: ${fileCount}개
- 샘플 파일 수: ${sampleFiles.length}개
</statistics>

<patterns>
${patternsText}
</patterns>

<samples>
${samplesText}
</samples>`;

  // ========================================
  // STEP 1: Generate Meta-Prompt
  // ========================================
  const generatedPrompt = await callMetaPromptGeneration(
    metaPrompt,
    dataPrompt,
    model,
    debug
  );

  // ========================================
  // STEP 2: Generate Guide Document
  // ========================================
  let content = await callGuideDocumentGeneration(
    generatedPrompt,
    dataPrompt,
    model,
    debug
  );

  // Post-process: Compress guide
  content = await compressGuide(content, model, debug);

  return {
    prefix,
    content,
  };
}

// ===================================================================================
// Small Segment Processing (--include-small option)
// ===================================================================================

/**
 * LLM 1: Select main files for small segments (when total lines > 2000)
 *
 * @param prefix - Segment prefix
 * @param files - All files in this segment
 * @param model - LLM model
 * @param debug - Debug mode
 * @returns Selected important files (5-10 files)
 */
export async function selectMainFilesForSmallSegment(
  prefix: string,
  files: FileInfo[],
  model: string,
  debug: boolean
): Promise<FileInfo[]> {
  const onlyFiles = files.filter(f => f.type === 'file');

  const systemPrompt = `해당 프로젝트를 분석하기 위한 파일을 추출합니다.
아래 조건에 해당하는 파일의 경로를 배열로 반환하세요.

1. 추출된 파일의 라인 수는 2000줄 미만이어야 합니다.
2. 파일 네이밍, 규칙이 반복된 패턴이 있다면 대표 1 파일을 반환합니다.
3. (2)를 통해서 규칙을 추출할 수 없다면, 해당 프로젝트를 대표할 수 있는 파일의 경로를 이름을 통해 추측해서 반환하세요. 추측할 수 없다면 중간 크기의 파일을 반환하세요.

반드시 JSON 배열만 반환하세요. 다른 텍스트는 포함하지 마세요.
["path/to/file.ts", ...]`;

  const fileList = onlyFiles
    .map(f => `${f.relativePath} (${f.lines ?? 0}줄)`)
    .join('\n');

  const userPrompt = `<prefix>
${prefix}
</prefix>

<files>
${fileList}
</files>`;

  if (debug) {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 SELECT MAIN FILES FOR SMALL SEGMENT');
    console.log('='.repeat(80));
    console.log(`PREFIX: ${prefix}`);
    console.log(`FILES (${onlyFiles.length}개):\n${fileList}`);
    console.log('='.repeat(80) + '\n');
  }

  const response = await callLLM({
    systemPrompt,
    userPrompt,
    model,
    temperature: 0.1,
    debug
  });

  // Parse JSON array of paths
  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : response.trim();
    const selectedPaths: string[] = JSON.parse(jsonStr);

    const result = onlyFiles.filter(f => selectedPaths.includes(f.relativePath));

    if (debug) {
      console.log(`✓ Selected ${result.length} files:`, result.map(f => f.relativePath));
    }

    return result.length > 0 ? result : onlyFiles;
  } catch {
    // Fallback: return all files
    if (debug) {
      console.log('⚠️  JSON parse failed, returning all files');
    }
    return onlyFiles;
  }
}

export type SmallSegmentType = 'domain' | 'decompounded' | 'lined';

/**
 * LLM 2: Classify small segment structure type
 *
 * @param prefix - Segment prefix
 * @param files - All files in this segment (FileInfo, no content)
 * @param model - LLM model
 * @param debug - Debug mode
 * @returns Classified structure type
 */
export async function classifySmallSegmentType(
  prefix: string,
  files: FileInfo[],
  model: string,
  debug: boolean
): Promise<SmallSegmentType> {
  const systemPrompt = `주어진 모듈의 폴더/파일 구조를 보고, 아래 3가지 유형 중 하나로 분류하세요.
애매한 경우 가장 가까운 유형을 선택하세요. (none 없음)

폴더 구조가 없거나 빈약한 경우, 파일 네이밍을 통해 적합한 유형을 판단하세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. domain
도메인(명사) 폴더가 가로로 확장되는 구조.
각 도메인 폴더 안에 비슷한 파일들이 반복됩니다.

예시 (폴더 있음):
service/
  bookmark/
    BookmarkReader.ts
    BookmarkWriter.ts
  user/
    UserReader.ts
    UserWriter.ts

예시 (폴더 없음, 네이밍으로 판단):
BookmarkReader.ts
UserReader.ts
CommentWriter.ts

---

2. decompounded
기능/레이어 폴더로 분해되는 구조.
각 레이어 폴더에 여러 도메인의 파일이 모여 있습니다.

예시 (폴더 있음):
api/
  bookmarkApi.ts
  userApi.ts
query/
  bookmarkQuery.ts
  userQuery.ts

예시 (폴더 없음, 네이밍으로 판단):
bookmarkApi.ts
userApi.ts
bookmarkQuery.ts
userQuery.ts

---

3. lined
동일한 종류/목적의 파일들이 모여 있는 구조.
뚜렷한 도메인/레이어 구분이 없고, 특별한 규칙이 없는 경우도 lined입니다.

예시 (폴더 있음, 제약 있음):
exceptions/
  BookmarkNotFoundException.ts
  UserNotFoundException.ts
  InvalidTargetTypeException.ts

예시 (폴더 없음, 제약 있음):
BookmarkNotFoundException.ts
UserNotFoundException.ts
DatabaseConfig.ts
RedisConfig.ts

예시 (폴더 없음, 규칙 없음 - 이것도 lined):
StringUtils.ts
DateUtils.ts
FileHelper.ts
MathUtil.ts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

반드시 아래 JSON 형식만 반환하세요. 다른 텍스트는 포함하지 마세요.
{
  "type": "domain" | "decompounded" | "lined",
  "reasoning": "판단 근거 1-2문장"
}`;

  const treeLines = files.map(f => {
    const indent = '  '.repeat(Math.max(0, f.depth - 1));
    const suffix = f.type === 'directory' ? '/' : f.lines ? ` (${f.lines}줄)` : '';
    return `${indent}${f.name}${suffix}`;
  }).join('\n');

  const userPrompt = `<prefix>
${prefix}
</prefix>

<tree>
${treeLines}
</tree>`;

  if (debug) {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 CLASSIFY SMALL SEGMENT TYPE');
    console.log('='.repeat(80));
    console.log(`PREFIX: ${prefix}`);
    console.log(`TREE:\n${treeLines}`);
    console.log('='.repeat(80) + '\n');
  }

  const response = await callLLM({
    systemPrompt,
    userPrompt,
    model,
    temperature: 0.1,
    debug
  });

  // Parse JSON response
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : response.trim();
    const parsed = JSON.parse(jsonStr);

    const validTypes: SmallSegmentType[] = ['domain', 'decompounded', 'lined'];
    if (!validTypes.includes(parsed.type)) {
      throw new Error(`Invalid type: ${parsed.type}`);
    }

    if (debug) {
      console.log(`✓ Classified as: ${parsed.type}`);
      console.log(`  Reasoning: ${parsed.reasoning}`);
    }

    return parsed.type as SmallSegmentType;
  } catch {
    // Fallback: lined (가장 보수적인 선택)
    if (debug) {
      console.log('⚠️  JSON parse failed, defaulting to lined');
    }
    return 'lined';
  }
}

/**
 * Build system prompt A: for domain / decompounded small segments
 * Focus: flow, patterns, how to add new domain/feature
 */
function buildSmallSegmentPromptA(prefix: string): string {
  return `<goal>
당신은 해당 모듈의 코딩 가이드 문서를 작성합니다.

소스 코드와 트리 구조를 분석하여,
코딩 에이전트가 이 모듈에서 새 파일/기능을 추가할 때
참고할 가이드 문서를 생성하세요.
</goal>

<주의-섹션>
- 소스 코드에서 실제로 확인된 패턴과 규칙만 서술하세요.
- 소스에 없는 클래스, 메서드, 패턴을 추론하거나 만들어내지 마세요.
- 파악이 안 되는 항목은 반드시 생략하세요.
</주의-섹션>

<guide>
규칙 작성 전, 아래 내용을 파악하세요.

1. 주요 기능의 흐름이 있는 경우 파악하세요.
2. 외부에 인터페이스되는 기능이 있는지, 단일 파일로서만 존재하는지 파악하세요.
3. 공통적·특정 파일에서 지켜야 하는 제약이 있다면 파악하세요.

---

주요 기능의 흐름이 존재하는 경우,
대표 파일의 코드 스니펫과 목적을 명시하고,
새로운 도메인·기능 추가 시 어떻게 해야 하는지 가이드를 작성하세요.

외부에 인터페이스되거나 요소 간 흐름이 있는 경우,
흐름이 어떻게 이어지는지 패턴을 도출하여
연결부에 대한 스니펫과 함께 규칙을 명시하세요.

그 외 특정 패턴 또는 전체 파일에서 지켜야 하는 제약이 있다면 명시하세요.

파악이 안 되는 항목은 생략하세요.
</guide>

<example>
입력 트리:
service/
  BookmarkReader.ts (45줄)
  UserReader.ts (38줄)
  BookmarkWriter.ts (52줄)

출력:
\`\`\`markdown
---
paths:
  - "service/**/*"
---

# service

## 주요 패턴

Reader/Writer로 역할이 분리됩니다. 새 도메인 추가 시 동일하게 분리하세요.

\`\`\`ts
export class BookmarkReader {
  async findByUserId(userId: string): Promise<Bookmark[]> { ... }
}
export class BookmarkWriter {
  async create(data: CreateBookmarkDto): Promise<Bookmark> { ... }
}
\`\`\`
\`\`\`
</example>

<example-if-exists>
외부 인터페이스/연결부 흐름이 있다면 추가:

입력 트리:
api/
  bookmarkApi.ts (60줄)
  userApi.ts (55줄)

출력 (추가 섹션):
\`\`\`markdown
## 연결 구조

Controller → bookmarkApi → BookmarkReader/Writer 순으로 호출됩니다.

\`\`\`ts
// bookmarkApi.ts
export const bookmarkApi = {
  getList: (userId: string) => bookmarkReader.findByUserId(userId),
  create: (data: CreateDto) => bookmarkWriter.create(data),
}
\`\`\`
\`\`\`
</example-if-exists>

<output-format>
\`\`\`markdown
---
paths:
  - "${prefix}**/*"
---

# ${prefix.replace(/\/$/, '') || 'Guide'}

[가이드 내용]
\`\`\`
</output-format>`;
}

/**
 * Build system prompt B: for lined small segments
 * Focus: constraints and naming conventions; return empty if none found
 */
function buildSmallSegmentPromptB(prefix: string): string {
  return `<goal>
당신은 해당 모듈의 코딩 가이드 문서를 작성합니다.

소스 코드와 트리 구조를 분석하여,
코딩 에이전트가 이 모듈에서 새 파일을 추가할 때
참고할 가이드 문서를 생성하세요.
</goal>

<주의-섹션>
- 소스 코드에서 실제로 확인된 패턴과 규칙만 서술하세요.
- 소스에 없는 클래스, 메서드, 패턴을 추론하거나 만들어내지 마세요.
- 파악이 안 되는 항목은 반드시 생략하세요.
</주의-섹션>

<guide>
이 모듈은 동일한 종류의 파일이 모여 있는 구조입니다.

아래 내용을 파악하세요.

1. 파일 전체에서 공통적으로 지켜야 하는 제약이 있는지 파악하세요.
2. 네이밍 규칙이 있는지 파악하세요.

---

제약사항이 있다면 명시하세요.
각 제약사항에는 소스 코드에서 발췌한 예시 코드를 함께 포함하세요.
제약사항이 없거나 파악이 안 된다면, 빈 문자열을 반환하세요.
</guide>

<example-with-constraints>
입력: exceptions/ 내 BookmarkNotFoundException.ts, UserNotFoundException.ts

출력:
\`\`\`markdown
---
paths:
  - "exceptions/**/*"
---

# exceptions

## Naming
- {Domain}NotFoundException 형식

## Constraints
- RuntimeException 상속 필수

\`\`\`java
public final class BookmarkNotFoundException extends RuntimeException {
    public BookmarkNotFoundException(Long id) {
        super(format(MESSAGE, id));
    }
}
\`\`\`
\`\`\`
</example-with-constraints>

<example-no-constraints>
입력: StringUtils.ts, DateUtils.ts, MathUtil.ts

출력: (빈 문자열)
</example-no-constraints>

<output-format>
제약사항이 있는 경우:
\`\`\`markdown
---
paths:
  - "${prefix}**/*"
---

# ${prefix.replace(/\/$/, '') || 'Guide'}

[제약사항 및 네이밍 규칙 + 각 항목에 예시 코드]
\`\`\`

제약사항이 없는 경우: 빈 문자열 반환
</output-format>`;
}

/**
 * Build user prompt for small segment (tree + source files)
 */
function buildSmallSegmentUserPrompt(
  prefixFiles: FileInfo[],
  sampleFiles: SampleFile[]
): string {
  const treeLines = prefixFiles.map(f => {
    const indent = '  '.repeat(Math.max(0, f.depth - 1));
    const suffix = f.type === 'directory' ? '/' : f.lines ? ` (${f.lines}줄)` : '';
    return `${indent}${f.name}${suffix}`;
  }).join('\n');

  return `<tree>
${treeLines}
</tree>

<source-files>
${formatSampleFiles(sampleFiles)}
</source-files>`;
}

/**
 * LLM 3: Generate rules for small segments
 *
 * Small flat segments (< 15 files) may contain coding conventions,
 * config patterns, or style rules extractable directly from source code.
 */
export async function generateRulesForSmallSegment(
  prefix: string,
  prefixFiles: FileInfo[],
  sampleFiles: SampleFile[],
  segmentType: SmallSegmentType,
  model: string,
  debug: boolean
): Promise<string> {
  const systemPrompt = segmentType === 'lined'
    ? buildSmallSegmentPromptB(prefix)
    : buildSmallSegmentPromptA(prefix);

  const userPrompt = buildSmallSegmentUserPrompt(prefixFiles, sampleFiles);

  if (debug) {
    console.log('\n' + '='.repeat(80));
    console.log(`📝 GENERATE RULES (SMALL SEGMENT - ${segmentType.toUpperCase()})`);
    console.log('='.repeat(80));
    console.log('SYSTEM:\n', systemPrompt.substring(0, 500) + '...');
    console.log('\nUSER:\n', userPrompt.substring(0, 300) + '...');
    console.log('='.repeat(80) + '\n');
  }

  let content = await callLLM({
    systemPrompt,
    userPrompt,
    model,
    temperature: 0.2,
    debug
  });

  // lined: if empty response, return as-is (no compress needed)
  if (segmentType === 'lined' && content.trim() === '') {
    return '';
  }

  // Post-process: Compress guide if needed
  content = await compressGuide(content, model, debug);

  return content;
}

