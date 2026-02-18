# LLM Client 추상화 TODO

## 목표
OpenAI뿐만 아니라 Anthropic Claude, 기타 LLM을 지원하도록 추상화

## 현재 상태
- OpenAI만 Singleton 패턴으로 구현됨 (`openai.ts`)
- 다른 LLM 지원 없음

## 설계 방안

### 1. 공통 인터페이스 정의 (`types.ts`)

```typescript
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMClient {
  chat(request: LLMRequest): Promise<LLMResponse>;
  name: string;
}
```

### 2. Provider별 구현

**OpenAI Provider** (`openai.ts` 수정)
```typescript
export class OpenAIProvider implements LLMClient {
  name = 'openai';

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const openai = OpenAIClient.getInstance();
    const response = await openai.chat.completions.create({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      ...(request.jsonMode && { response_format: { type: 'json_object' } })
    });

    return {
      content: response.choices[0].message.content || '',
      model: response.model,
      usage: { ... }
    };
  }
}
```

**Anthropic Provider** (`anthropic.ts` 신규)
```typescript
export class AnthropicProvider implements LLMClient {
  name = 'anthropic';

  async chat(request: LLMRequest): Promise<LLMResponse> {
    // Anthropic API 호출 구현
  }
}
```

### 3. Factory 패턴 (`factory.ts` 신규)

```typescript
export function getLLMClient(provider?: string): LLMClient {
  const providerName = provider || process.env.LLM_PROVIDER || 'openai';

  switch (providerName) {
    case 'openai':
      return new OpenAIProvider();
    case 'anthropic':
      return new AnthropicProvider();
    default:
      throw new Error(`Unknown LLM provider: ${providerName}`);
  }
}
```

### 4. 사용 예시

**기존:**
```typescript
const client = OpenAIClient.getInstance();
const response = await client.chat.completions.create({...});
```

**변경 후:**
```typescript
const client = getLLMClient();
const response = await client.chat({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ],
  temperature: 0.2,
  jsonMode: true
});
```

## 작업 순서

1. [ ] `types.ts` 생성 - 공통 인터페이스 정의
2. [ ] `openai.ts` 리팩토링 - LLMClient 인터페이스 구현
3. [ ] `anthropic.ts` 생성 - Anthropic provider 구현
4. [ ] `factory.ts` 생성 - Provider factory
5. [ ] 기존 호출부 수정 - 모든 LLM 호출을 factory 패턴으로 변경
6. [ ] 환경변수 지원 - `LLM_PROVIDER` 추가
7. [ ] README 업데이트 - 다중 LLM 지원 안내

## 지원 예정 LLM

- [x] OpenAI (GPT-4, GPT-5.1)
- [ ] Anthropic (Claude 3.5 Sonnet, etc)
- [ ] 기타 (추후 결정)

## 참고사항

- YAGNI 원칙: 당장 필요 없으면 과도한 추상화 지양
- 하지만 오늘 중 2-3개 LLM 지원 예정이므로 추상화 필요
- API 차이점 고려 필요 (max_tokens, response_format 등)
