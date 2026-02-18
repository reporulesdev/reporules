import { preliminaryAnalysis } from '../preliminaryAnalysis';
import { detailedAnalysis } from '../detailedAnalysis';
import { generateLayerRules } from '../generateLayerRules';

describe('LLM Support Functions', () => {
  describe('Module exports', () => {
    it('should export preliminaryAnalysis function', () => {
      expect(preliminaryAnalysis).toBeDefined();
      expect(typeof preliminaryAnalysis).toBe('function');
    });

    it('should export detailedAnalysis function', () => {
      expect(detailedAnalysis).toBeDefined();
      expect(typeof detailedAnalysis).toBe('function');
    });

    it('should export generateLayerRules function', () => {
      expect(generateLayerRules).toBeDefined();
      expect(typeof generateLayerRules).toBe('function');
    });
  });

  // Note: Actual API call tests should be in integration tests
  // See test/integration/llm-analysis.test.ts
});
