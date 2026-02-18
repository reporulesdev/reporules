import { evaluateRules } from '../evaluateRules';
import { callLLM } from '../../../client/wrapper';
import { ProjectTree } from '../../projectTree';

jest.mock('../../../client/wrapper');

const mockCallLLM = callLLM as jest.MockedFunction<typeof callLLM>;

describe('evaluateRules', () => {
  let mockProjectTree: ProjectTree;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock ProjectTree
    mockProjectTree = {
      toTreeString: jest.fn().mockReturnValue('mock/tree/structure'),
      getFiles: jest.fn().mockReturnValue([]),
      pickByPrefix: jest.fn().mockReturnValue([])
    } as any;
  });

  describe('rule evaluation with recommendations', () => {
    it('should return "keep" recommendation for high quality rules', async () => {
      // Mock LLM response with high scores
      mockCallLLM.mockResolvedValue(JSON.stringify({
        prefix: 'modules/service/',
        patternQuality: { score: 8, reasoning: 'Good patterns' },
        actionability: { score: 9, reasoning: 'Very actionable' },
        conciseness: { score: 7, reasoning: 'Concise enough' },
        meaningfulness: { score: 8, reasoning: 'Meaningful' },
        completeness: { score: 9, reasoning: 'Complete' }
      }));

      const result = await evaluateRules(
        'modules/service/',
        '# Service Module Guide\n\nThis is a sample rule content.',
        mockProjectTree
      );

      expect(result.overallScore).toBe(8.2); // (8+9+7+8+9)/5
      expect(result.recommendation).toBe('keep');
      expect(result.prefix).toBe('modules/service/');
      expect(mockCallLLM).toHaveBeenCalledTimes(1);
    });

    it('should return "skip" recommendation when actionability is too low', async () => {
      // Mock LLM response with low actionability
      mockCallLLM.mockResolvedValue(JSON.stringify({
        prefix: 'modules/service/',
        patternQuality: { score: 7, reasoning: 'Decent patterns' },
        actionability: { score: 4, reasoning: 'Not actionable' }, // ← low
        conciseness: { score: 7, reasoning: 'Concise' },
        meaningfulness: { score: 6, reasoning: 'Some meaning' },
        completeness: { score: 7, reasoning: 'Complete' }
      }));

      const result = await evaluateRules(
        'modules/service/',
        'rule content',
        mockProjectTree
      );

      expect(result.recommendation).toBe('skip');
      expect(result.actionability.score).toBe(4);
    });

    it('should return "skip" recommendation when overall score is too low', async () => {
      // Mock LLM response with overall low scores
      mockCallLLM.mockResolvedValue(JSON.stringify({
        prefix: 'modules/util/',
        patternQuality: { score: 4, reasoning: 'Poor patterns' },
        actionability: { score: 5, reasoning: 'Barely actionable' },
        conciseness: { score: 4, reasoning: 'Too verbose' },
        meaningfulness: { score: 3, reasoning: 'Not meaningful' },
        completeness: { score: 4, reasoning: 'Incomplete' }
      }));

      const result = await evaluateRules(
        'modules/util/',
        'rule content',
        mockProjectTree
      );

      expect(result.overallScore).toBe(4); // (4+5+4+3+4)/5
      expect(result.recommendation).toBe('skip');
    });

    it('should return "regenerate_simplified" when pattern quality is very low', async () => {
      // Mock LLM response with very low pattern quality (15+ patterns)
      mockCallLLM.mockResolvedValue(JSON.stringify({
        prefix: 'modules/service/',
        patternQuality: { score: 3, reasoning: 'Too many patterns (15+)' }, // ← very low
        actionability: { score: 7, reasoning: 'Actionable' },
        conciseness: { score: 6, reasoning: 'Acceptable' },
        meaningfulness: { score: 6, reasoning: 'Some meaning' },
        completeness: { score: 6, reasoning: 'Complete' }
      }));

      const result = await evaluateRules(
        'modules/service/',
        'rule content',
        mockProjectTree
      );

      expect(result.recommendation).toBe('regenerate_simplified');
      expect(result.patternQuality.score).toBe(3);
    });

    it('should return "regenerate_simplified" when conciseness is very low (250+ lines)', async () => {
      // Mock LLM response with very low conciseness
      mockCallLLM.mockResolvedValue(JSON.stringify({
        prefix: 'modules/service/',
        patternQuality: { score: 6, reasoning: 'Acceptable patterns' },
        actionability: { score: 7, reasoning: 'Actionable' },
        conciseness: { score: 3, reasoning: 'Too long (250+ lines)' }, // ← very low
        meaningfulness: { score: 6, reasoning: 'Some meaning' },
        completeness: { score: 6, reasoning: 'Complete' }
      }));

      const result = await evaluateRules(
        'modules/service/',
        'rule content',
        mockProjectTree
      );

      expect(result.recommendation).toBe('regenerate_simplified');
      expect(result.conciseness.score).toBe(3);
    });

    it('should return "regenerate_minimal" for medium quality rules', async () => {
      // Mock LLM response with medium scores
      mockCallLLM.mockResolvedValue(JSON.stringify({
        prefix: 'modules/service/',
        patternQuality: { score: 6, reasoning: '11-14 patterns' },
        actionability: { score: 7, reasoning: 'Actionable' },
        conciseness: { score: 6, reasoning: 'Acceptable' },
        meaningfulness: { score: 6, reasoning: 'Some meaning' },
        completeness: { score: 6, reasoning: 'Complete' }
      }));

      const result = await evaluateRules(
        'modules/service/',
        'rule content',
        mockProjectTree
      );

      expect(result.overallScore).toBe(6.2); // (6+7+6+6+6)/5
      expect(result.recommendation).toBe('regenerate_minimal');
    });
  });

  describe('LLM interaction', () => {
    it('should call LLM with correct prompts', async () => {
      mockCallLLM.mockResolvedValue(JSON.stringify({
        prefix: 'test/',
        patternQuality: { score: 8, reasoning: '...' },
        actionability: { score: 8, reasoning: '...' },
        conciseness: { score: 8, reasoning: '...' },
        meaningfulness: { score: 8, reasoning: '...' },
        completeness: { score: 8, reasoning: '...' }
      }));

      await evaluateRules(
        'test/',
        'rule content here',
        mockProjectTree,
        'gpt-4o-mini',
        false
      );

      expect(mockCallLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('evaluating coding guidelines'),
          userPrompt: expect.stringContaining('rule content here'),
          model: 'gpt-4o-mini',
          temperature: 0.1,
          jsonMode: true,
          debug: false
        })
      );
    });
  });
});
