import { callLLM } from '../../client/wrapper';
import { ProjectTree } from '../projectTree';

/**
 * Rule Evaluation Result
 */
export interface RuleEvaluation {
  prefix: string;
  patternQuality: {
    score: number;        // 0-10
    reasoning: string;
  };
  actionability: {
    score: number;        // 0-10
    reasoning: string;
  };
  conciseness: {
    score: number;        // 0-10
    reasoning: string;
  };
  meaningfulness: {
    score: number;        // 0-10
    reasoning: string;
  };
  completeness: {
    score: number;        // 0-10
    reasoning: string;
  };
  overallScore: number;   // 0-10 (평균)
  recommendation: 'keep' | 'regenerate_simplified' | 'regenerate_minimal' | 'skip';
  summary: string;
}

/**
 * Step 3-4: Evaluate Generated Rules
 *
 * 생성된 규칙 문서의 품질을 5가지 요소로 평가
 */
export async function evaluateRules(
  prefix: string,
  ruleContent: string,
  projectTree: ProjectTree,
  model: string = 'gpt-5.1-2025-11-13',
  debug: boolean = false
): Promise<RuleEvaluation> {
  // Build prompts
  const systemPrompt = buildEvaluationSystemPrompt(prefix);
  const userPrompt = buildEvaluationUserPrompt(ruleContent, projectTree);

  if (debug) {
    console.log('\n' + '='.repeat(80));
    console.log('📝 EVALUATION PROMPT');
    console.log('='.repeat(80));
    console.log('SYSTEM:\n', systemPrompt.substring(0, 500) + '...');
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

  const result = JSON.parse(content) as RuleEvaluation;

  // Calculate overall score
  result.overallScore = (
    result.patternQuality.score +
    result.actionability.score +
    result.conciseness.score +
    result.meaningfulness.score +
    result.completeness.score
  ) / 5;

  // Determine recommendation based on scores
  result.recommendation = determineRecommendation(result);

  if (debug) {
    console.log('✓ Evaluation complete');
    console.log(`  Overall Score: ${result.overallScore.toFixed(1)}/10`);
    console.log(`  Recommendation: ${result.recommendation}`);
  }

  return result;
}

/**
 * Build evaluation system prompt (instructions)
 */
function buildEvaluationSystemPrompt(prefix: string): string {
  return `You are an expert at evaluating coding guidelines. Respond with JSON only.

<goal>
구획에 대해 생성된 코딩 가이드 문서를 평가합니다.

5가지 요소를 각각 0-10점으로 평가하고, 각 평가에 대한 근거를 제시하세요.
</goal>

<evaluation-criteria>

**1. Pattern Quality (패턴 품질)**
- 패턴 개수가 적절한가? (4-8개가 이상적, 너무 적거나 많으면 감점)
- 각 패턴의 역할이 명확히 구분되는가?
- 비슷한 패턴이 중복되어 있지 않은가? (예: *Executor, *QueryExecutor, Search*Executor)
- 억지로 만든 패턴이 아닌가? (1-2회만 등장하는데 패턴이라고 주장)

**평가 척도** (매우 엄격하게 적용):
- 9-10: 패턴 개수 이상적(4-8개), 역할 매우 명확, 중복 전혀 없음
- 7-8: 패턴 개수 적절(3개 or 9-10개), 역할 대체로 명확, 중복 거의 없음
- 5-6: 패턴 개수 많음(11-14개), 일부 중복/애매함
- 3-4: 패턴 개수 너무 적거나 많음(2개 or 15-20개), 중복 많음
- 0-2: 패턴 개수 극단적(1개 or 21+개), 패턴 의미 없음

---

**2. Actionability (실행 가능성)**
- 개발자가 "Product 기능 추가해줘" 같은 요청 받았을 때 이 가이드만으로 작성 가능한가?
- 예시 코드가 구체적인가? (추상적이지 않고)
- 파일 위치와 네이밍이 명확한가?
- "어떻게 해야 하는지"가 분명한가?

**평가 척도**:
- 9-10: 가이드만으로 즉시 코드 작성 가능, 예시 구체적, 위치/네이밍 명확
- 7-8: 대부분 작성 가능, 일부 추론 필요
- 5-6: 방향은 알 수 있지만 구체성 부족
- 3-4: 추상적 설명만 있고 실행 방법 불명확
- 0-2: 전혀 실행 불가능, 애매모호함

---

**3. Conciseness (간결성)**
- 문서 길이가 적절한가? (100-150줄이 이상적)
- Directory Structure가 간소화되어 있는가? (모든 파일 나열 vs 대표만)
- 불필요한 반복이 없는가?
- 핵심만 간결하게 전달하는가?

**평가 척도** (매우 엄격하게 적용):
- 9-10: 100-150줄, 간소화된 Directory, 반복 전혀 없음, 핵심만 전달
- 7-8: 150-200줄, 대체로 간결함, 약간의 반복
- 5-6: 200-250줄, 일부 장황하거나 반복 있음
- 3-4: 250-350줄, 과도한 나열, 반복 많음
- 0-2: 350줄 이상, 극도로 장황, 읽기 매우 어려움

---

**4. Meaningfulness (의미성)**
- 프로젝트 특수한 내용을 포함하는가?
- 자명한 것만 나열하지 않았는가? (예: "@Service 사용"만 있으면 의미 없음)
- 실제 코드에서 관찰된 내용인가? (임의로 만든 가짜 예시 없음)
- 개발자에게 실질적 도움이 되는가?

**평가 척도**:
- 9-10: 프로젝트 특수 컨벤션 명확, 실제 코드 기반, 실질적 도움
- 7-8: 대부분 의미 있음, 일부 자명한 내용 포함
- 5-6: 일반적 내용과 특수 내용 혼재
- 3-4: 대부분 자명하거나 일반적, 특수성 부족
- 0-2: 완전히 자명하거나 의미 없음

---

**5. Completeness (완성도)**
- 예시가 실제 샘플 파일 기반인가?
- Examples/Conventions/Directory Structure 섹션이 모두 있는가?
- 임의로 만든 가짜 예시는 없는가? (DevRunnerController 같은 프로젝트에 없는 파일)
- 필요한 정보가 누락되지 않았는가?

**평가 척도**:
- 9-10: 모든 섹션 완비, 실제 파일 기반, 정보 충분
- 7-8: 대부분 완비, 일부 섹션 약함
- 5-6: 일부 섹션 누락 또는 정보 부족
- 3-4: 주요 섹션 누락, 예시 부족
- 0-2: 거의 비어있거나 가짜 예시만

</evaluation-criteria>

<output-format>
JSON 형식으로 반환:
{
  "prefix": "${prefix}",
  "patternQuality": {
    "score": 8,
    "reasoning": "패턴 5개로 적절. Reader/Writer 역할 명확. 중복 없음."
  },
  "actionability": {
    "score": 9,
    "reasoning": "BookmarkReader 예시 구체적. 파일 위치 명확. 즉시 코드 작성 가능."
  },
  "conciseness": {
    "score": 7,
    "reasoning": "200줄. 약간 길지만 Directory Structure 간소화 잘됨."
  },
  "meaningfulness": {
    "score": 8,
    "reasoning": "CQRS 패턴 명확. Default* prefix는 프로젝트 특수. 실제 코드 기반."
  },
  "completeness": {
    "score": 9,
    "reasoning": "모든 섹션 완비. 실제 BookmarkReader.java 기반 예시. 정보 충분."
  },
  "summary": "Service 모듈 가이드는 명확한 CQRS 패턴을 잘 설명하고 있으며, 실행 가능성이 높음. 약간 길지만 허용 범위."
}
</output-format>

위 5가지 요소를 각각 0-10점으로 평가하고, 각 평가에 대한 **구체적인 근거**를 제시하세요.`;
}

/**
 * Build evaluation user prompt (data only)
 */
function buildEvaluationUserPrompt(
  ruleContent: string,
  projectTree: ProjectTree
): string {
  // Get project tree for context
  const treeString = projectTree.toTreeString();

  return `<rule-document>
${ruleContent}
</rule-document>

<project-tree>
${treeString}
</project-tree>`;
}

/**
 * Determine recommendation based on scores (엄격한 기준)
 */
function determineRecommendation(evaluation: RuleEvaluation): 'keep' | 'regenerate_simplified' | 'regenerate_minimal' | 'skip' {
  const { overallScore, patternQuality, actionability, conciseness } = evaluation;

  // Skip: 품질이 너무 낮음
  if (overallScore < 5 || actionability.score < 5) {
    return 'skip';
  }

  // Regenerate Simplified: 패턴이 너무 많거나 너무 장황함
  // Pattern Quality 4점 이하 (15+개 패턴) 또는 Conciseness 4점 이하 (250+줄)
  if (patternQuality.score <= 4 || conciseness.score <= 4) {
    return 'regenerate_simplified';
  }

  // Regenerate Minimal: 패턴이 너무 적거나 전체 점수가 낮음
  // Pattern Quality 6점 이하 (2-3개 or 11-14개 패턴) 그리고 전체 점수 7점 미만
  if (patternQuality.score <= 6 && overallScore < 7) {
    return 'regenerate_minimal';
  }

  // Keep: 전반적으로 좋은 품질 (패턴 품질 7 이상 필수)
  if (overallScore >= 7 && actionability.score >= 7 && patternQuality.score >= 7) {
    return 'keep';
  }

  // 기타: regenerate_minimal
  return 'regenerate_minimal';
}
