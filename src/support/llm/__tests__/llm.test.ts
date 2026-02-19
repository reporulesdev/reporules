import { detectProjectMeta } from '../detectProjectMeta';
import { segmentProject } from '../segmentProject';
import { generateLayerRules } from '../generateLayerRules';

describe('LLM Support Functions', () => {
  describe('Module exports', () => {
    it('should export detectProjectMeta function', () => {
      expect(detectProjectMeta).toBeDefined();
      expect(typeof detectProjectMeta).toBe('function');
    });

    it('should export segmentProject function', () => {
      expect(segmentProject).toBeDefined();
      expect(typeof segmentProject).toBe('function');
    });

    it('should export generateLayerRules function', () => {
      expect(generateLayerRules).toBeDefined();
      expect(typeof generateLayerRules).toBe('function');
    });
  });

  // Note: Actual API call tests should be in integration tests
  // See test/integration/llm-analysis.test.ts
});
