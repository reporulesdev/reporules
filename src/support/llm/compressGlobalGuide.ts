import { callLLM } from '../../client/wrapper';

/**
 * Compress global guide document to 150-200 lines
 * Different strategy from module-specific guides
 */
export async function compressGlobalGuide(
  originalContent: string,
  model: string = 'gpt-5.1-2025-11-13',
  debug: boolean = false
): Promise<string> {
  const systemPrompt = buildCompressionSystemPrompt();
  const userPrompt = buildCompressionUserPrompt(originalContent);

  if (debug) {
    console.log('\n' + '='.repeat(80));
    console.log('📦 COMPRESSING GLOBAL GUIDE');
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
    console.log('✓ Global guide compression complete');
    console.log(`  Compressed lines: ${compressed.split('\n').length}`);
    console.log('='.repeat(80) + '\n');
  }

  return compressed;
}

/**
 * Build system prompt for global guide compression
 */
function buildCompressionSystemPrompt(): string {
  return `# Global Guide 압축

당신은 **Claude Code 에이전트가 읽을 전역 가이드를 압축**하는 작업자입니다.

## 🎯 목표

- **200줄 이하 필수** (150-180줄 목표)
- 일반 권고사항과 프로젝트별 패턴을 **차별적으로 압축**

---

## 📋 섹션별 압축 전략

### 1. 언어/프레임워크 원칙 (일반 권고)
**중요도: 높음** - 모든 프로젝트에 적용

**압축 방법:**
- 핵심 원칙만 간결하게 (bullet point)
- 예시 코드는 2-3줄 이내
- "왜"는 제거, "무엇"만 남김

**예시:**

변경 전:
\`\`\`
### SOLID 원칙

**Single Responsibility Principle (SRP)**
- 한 클래스는 하나의 책임만 가져야 합니다
- 변경의 이유가 하나만 있어야 합니다
- 이유: 유지보수성과 테스트 용이성 향상

\`\`\`java
// Bad
class UserService {
    void saveUser() { ... }
    void sendEmail() { ... }
    void generateReport() { ... }
}

// Good
class UserService {
    void saveUser() { ... }
}
class EmailService {
    void sendEmail() { ... }
}
class ReportService {
    void generateReport() { ... }
}
\`\`\`
\`\`\`

변경 후:
\`\`\`
### SOLID 원칙

**SRP**: 한 클래스는 하나의 책임만
**OCP**: 확장에는 열려있고, 수정에는 닫혀있게
**LSP**: 서브타입은 기반 타입으로 교체 가능
**ISP**: 인터페이스 분리
**DIP**: 추상화에 의존
\`\`\`

---

### 2. 공통 적용 규칙
**중요도: 중간** - 네이밍, 에러 핸들링, 로깅 등

**압축 방법:**
- Bullet point로 간결하게
- 예시 코드는 1-2줄만
- 설명은 최소화

**예시:**

변경 전:
\`\`\`
### 네이밍 규칙

클래스명은 PascalCase를 사용합니다:
- 명사 사용
- 의미를 명확하게
- 약어는 피하고 풀네임 사용

\`\`\`java
public class UserAccountManager { }
public class OrderProcessingService { }
\`\`\`

메서드명은 camelCase를 사용합니다:
- 동사로 시작
- 의도를 명확하게

\`\`\`java
public void calculateTotalPrice() { }
public boolean isValidUser() { }
\`\`\`
\`\`\`

변경 후:
\`\`\`
### 네이밍 규칙

- 클래스: PascalCase, 명사 (예: \`UserService\`)
- 메서드: camelCase, 동사 시작 (예: \`calculateTotal()\`)
- 변수: camelCase, 의미 명확
- 상수: UPPER_SNAKE_CASE
\`\`\`

---

### 3. 프로젝트별 패턴 (관찰된 것)
**중요도: 낮음** - 이 프로젝트에서만 관찰

**압축 방법:**
- **1줄 설명 + 1-2줄 코드**
- "알고만 있으면 됨" 수준
- 자세한 설명 제거

**예시:**

변경 전:
\`\`\`
**1. Lombok 애노테이션 적극 사용**
- 설명: 이 프로젝트는 보일러플레이트 코드 감소를 위해 Lombok을 적극 활용합니다
- 이유: 코드 간결성과 유지보수성 향상
- 관찰: 대부분의 데이터 클래스에서 사용됨

\`\`\`java
@Value
@Builder
public class UserDto {
    String name;
    String email;
    Integer age;
}

// 기존 방식과 비교:
public class UserDto {
    private final String name;
    private final String email;
    private final Integer age;

    public UserDto(String name, String email, Integer age) {
        this.name = name;
        this.email = email;
        this.age = age;
    }

    public String getName() { return name; }
    public String getEmail() { return email; }
    public Integer getAge() { return age; }
}
\`\`\`
\`\`\`

변경 후:
\`\`\`
**1. Lombok 애노테이션 사용**
\`\`\`java
@Value @Builder
public class UserDto { String name; String email; }
\`\`\`

**2. Builder 패턴 선호**
\`\`\`java
User.builder().name("kim").email("a@b.com").build();
\`\`\`

**3. Optional 반환**
\`\`\`java
Optional<User> findById(Long id);
\`\`\`
\`\`\`

---

## ⚠️ 제약사항

- ✅ Frontmatter 유지 (\`---\\npaths:\\n...\`)
- ✅ 섹션 구조 유지 (1. 언어 원칙, 2. 공통 규칙, 3. 프로젝트 패턴)
- ❌ 내용 추가 금지
- ❌ 의미 변경 금지
- 🚨 **200줄 초과 절대 금지**

---

## 🎯 최종 목표

- **총 라인수**: 150-180줄 (200줄 절대 초과 금지)
- **형식**: 유효한 Markdown
- **섹션 1 (일반 권고)**: 간결하게 유지, 예시 2-3줄
- **섹션 2 (공통 규칙)**: Bullet point, 예시 1-2줄
- **섹션 3 (프로젝트 패턴)**: 1줄 설명 + 1-2줄 코드

압축된 문서만 출력하세요. 다른 설명은 필요 없습니다.`;
}

/**
 * Build user prompt for compression
 */
function buildCompressionUserPrompt(originalContent: string): string {
  const lineCount = originalContent.split('\n').length;
  return `아래 Global Guide를 압축하세요 (현재 ${lineCount}줄 → 목표 150-180줄):

${originalContent}`;
}
