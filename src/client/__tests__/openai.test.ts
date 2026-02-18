import OpenAIClient from '../openai';

describe('OpenAIClient (Singleton)', () => {
  const DUMMY_API_KEY = 'sk-test-dummy-key-for-unit-tests';

  beforeEach(() => {
    // Reset singleton before each test
    OpenAIClient.reset();
  });

  afterEach(() => {
    OpenAIClient.reset();
  });

  describe('Initialization', () => {
    it('should initialize with API key', () => {
      expect(() => OpenAIClient.initialize(DUMMY_API_KEY)).not.toThrow();
    });

    it('should throw error when getting instance without initialization or env var', () => {
      // Clear env var for this test
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      expect(() => OpenAIClient.getInstance()).toThrow('OpenAI client not initialized');

      // Restore env var
      if (originalKey) {
        process.env.OPENAI_API_KEY = originalKey;
      }
    });
  });

  describe('Singleton behavior', () => {
    it('should return same instance on multiple calls', () => {
      OpenAIClient.initialize(DUMMY_API_KEY);

      const instance1 = OpenAIClient.getInstance();
      const instance2 = OpenAIClient.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should reset instance', () => {
      OpenAIClient.initialize(DUMMY_API_KEY);
      const instance1 = OpenAIClient.getInstance();

      OpenAIClient.reset();
      OpenAIClient.initialize(DUMMY_API_KEY);
      const instance2 = OpenAIClient.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Environment variable fallback', () => {
    it('should use OPENAI_API_KEY from environment if not explicitly initialized', () => {
      const originalKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = DUMMY_API_KEY;

      expect(() => OpenAIClient.getInstance()).not.toThrow();

      // Restore
      if (originalKey) {
        process.env.OPENAI_API_KEY = originalKey;
      } else {
        delete process.env.OPENAI_API_KEY;
      }
    });
  });
});
