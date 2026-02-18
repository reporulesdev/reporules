import { detailedAnalysis } from '../detailedAnalysis';
import { callLLM } from '../../../client/wrapper';
import { ProjectTree } from '../../projectTree';
import { PreliminaryAnalysisResult } from '../../../data/types';

jest.mock('../../../client/wrapper');

const mockCallLLM = callLLM as jest.MockedFunction<typeof callLLM>;

describe('detailedAnalysis', () => {
  let mockProjectTree: ProjectTree;
  let prelimResult: PreliminaryAnalysisResult;
  let configFiles: Map<string, string>;

  beforeEach(() => {
    jest.clearAllMocks();

    prelimResult = {
      language: 'java',
      buildSystem: 'gradle',
      complexity: 'medium',
      architecturePattern: 'hexagonal',
      structureLevel: 'strict',
      filesToRead: []
    };

    configFiles = new Map([
      ['build.gradle.kts', 'plugins { id("java") }']
    ]);

    mockProjectTree = {
      getFiles: jest.fn(),
      pickByPrefix: jest.fn(),
      toTreeString: jest.fn().mockReturnValue('mock/tree/structure')
    } as any;
  });

  describe('valid prefixes on first attempt', () => {
    it('should return valid prefixes immediately', async () => {
      // Mock LLM response
      mockCallLLM.mockResolvedValue(JSON.stringify({
        prefixes: ['modules/api/', 'modules/service/']
      }));

      // Mock ProjectTree validation - both prefixes valid
      (mockProjectTree.getFiles as jest.Mock).mockReturnValue([]);
      (mockProjectTree.pickByPrefix as jest.Mock)
        .mockReturnValueOnce([{ relativePath: 'modules/api/User.java' }])     // api/ valid
        .mockReturnValueOnce([{ relativePath: 'modules/service/BookmarkReader.java' }]);  // service/ valid

      const result = await detailedAnalysis(
        'tree string',
        mockProjectTree,
        configFiles,
        prelimResult
      );

      expect(result.prefixes).toEqual(['modules/api/', 'modules/service/']);
      expect(mockCallLLM).toHaveBeenCalledTimes(1);
    });

    it('should return global prefix [""] when LLM returns it', async () => {
      mockCallLLM.mockResolvedValue(JSON.stringify({
        prefixes: ['']
      }));

      (mockProjectTree.getFiles as jest.Mock).mockReturnValue([]);
      (mockProjectTree.pickByPrefix as jest.Mock).mockReturnValue([
        { relativePath: 'src/User.java' }
      ]);

      const result = await detailedAnalysis(
        'tree string',
        mockProjectTree,
        configFiles,
        prelimResult
      );

      expect(result.prefixes).toEqual(['']);
      expect(mockCallLLM).toHaveBeenCalledTimes(1);
    });
  });

  describe('auto-correction for single top-level directory', () => {
    it('should prepend single top-level directory to prefixes', async () => {
      // Mock LLM returns prefixes without top-level dir
      mockCallLLM.mockResolvedValue(JSON.stringify({
        prefixes: ['apps/', 'extensions/']
      }));

      // Mock single top-level directory "openclaw"
      (mockProjectTree.getFiles as jest.Mock).mockReturnValue([
        { relativePath: 'openclaw', type: 'directory', depth: 0 }  // Single top-level
      ]);

      // Mock validation - corrected paths are valid
      (mockProjectTree.pickByPrefix as jest.Mock)
        .mockReturnValueOnce([{ relativePath: 'openclaw/apps/main.ts' }])
        .mockReturnValueOnce([{ relativePath: 'openclaw/extensions/ext.ts' }]);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await detailedAnalysis(
        'tree string',
        mockProjectTree,
        configFiles,
        prelimResult
      );

      expect(result.prefixes).toEqual(['openclaw/apps/', 'openclaw/extensions/']);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auto-correction: Detected single top-level directory "openclaw/"')
      );

      consoleSpy.mockRestore();
    });

    it('should not modify prefixes when multiple top-level directories exist', async () => {
      mockCallLLM.mockResolvedValue(JSON.stringify({
        prefixes: ['frontend/', 'backend/']
      }));

      // Mock multiple top-level directories
      (mockProjectTree.getFiles as jest.Mock).mockReturnValue([
        { relativePath: 'frontend', type: 'directory', depth: 0 },
        { relativePath: 'backend', type: 'directory', depth: 0 }
      ]);

      (mockProjectTree.pickByPrefix as jest.Mock)
        .mockReturnValueOnce([{ relativePath: 'frontend/index.ts' }])
        .mockReturnValueOnce([{ relativePath: 'backend/main.java' }]);

      const result = await detailedAnalysis(
        'tree string',
        mockProjectTree,
        configFiles,
        prelimResult
      );

      expect(result.prefixes).toEqual(['frontend/', 'backend/']);
    });

    it('should not modify global prefix ""', async () => {
      mockCallLLM.mockResolvedValue(JSON.stringify({
        prefixes: ['']
      }));

      (mockProjectTree.getFiles as jest.Mock).mockReturnValue([
        { relativePath: 'openclaw', type: 'directory', depth: 0 }
      ]);

      (mockProjectTree.pickByPrefix as jest.Mock).mockReturnValue([
        { relativePath: 'openclaw/src/main.ts' }
      ]);

      const result = await detailedAnalysis(
        'tree string',
        mockProjectTree,
        configFiles,
        prelimResult
      );

      expect(result.prefixes).toEqual(['']);  // Should not be modified
    });

    it('should not double-prefix if already starts with top dir', async () => {
      mockCallLLM.mockResolvedValue(JSON.stringify({
        prefixes: ['openclaw/apps/']  // Already has top dir
      }));

      (mockProjectTree.getFiles as jest.Mock).mockReturnValue([
        { relativePath: 'openclaw', type: 'directory', depth: 0 }
      ]);

      (mockProjectTree.pickByPrefix as jest.Mock).mockReturnValue([
        { relativePath: 'openclaw/apps/main.ts' }
      ]);

      const result = await detailedAnalysis(
        'tree string',
        mockProjectTree,
        configFiles,
        prelimResult
      );

      expect(result.prefixes).toEqual(['openclaw/apps/']);  // No double prefix
    });
  });

  describe('retry on invalid prefix', () => {
    it('should retry when LLM returns invalid prefix', async () => {
      // First attempt: invalid prefix
      mockCallLLM
        .mockResolvedValueOnce(JSON.stringify({
          prefixes: ['invalid/path/']
        }))
        // Second attempt: valid prefix
        .mockResolvedValueOnce(JSON.stringify({
          prefixes: ['modules/api/']
        }));

      (mockProjectTree.getFiles as jest.Mock).mockReturnValue([]);
      (mockProjectTree.pickByPrefix as jest.Mock)
        .mockReturnValueOnce([])  // First: invalid (empty)
        .mockReturnValueOnce([{ relativePath: 'modules/api/User.java' }]);  // Second: valid

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await detailedAnalysis(
        'tree string',
        mockProjectTree,
        configFiles,
        prelimResult
      );

      expect(mockCallLLM).toHaveBeenCalledTimes(2);
      expect(result.prefixes).toEqual(['modules/api/']);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Attempt 1: Found 1 invalid prefix')
      );

      consoleSpy.mockRestore();
    });

    it('should include failed prefixes in retry prompt', async () => {
      mockCallLLM
        .mockResolvedValueOnce(JSON.stringify({ prefixes: ['invalid/'] }))
        .mockResolvedValueOnce(JSON.stringify({ prefixes: ['modules/api/'] }));

      (mockProjectTree.getFiles as jest.Mock).mockReturnValue([]);
      (mockProjectTree.pickByPrefix as jest.Mock)
        .mockReturnValueOnce([])
        .mockReturnValueOnce([{ relativePath: 'modules/api/User.java' }]);

      jest.spyOn(console, 'log').mockImplementation();

      await detailedAnalysis('tree', mockProjectTree, configFiles, prelimResult);

      // Check second call includes warning about failed prefix
      const secondCall = mockCallLLM.mock.calls[1];
      expect(secondCall[0].userPrompt).toContain('이전 시도 경고');
      expect(secondCall[0].userPrompt).toContain('invalid/');
    });

    it('should return valid prefixes and skip invalid ones after max retries', async () => {
      // All 3 attempts return mixed valid/invalid prefixes
      mockCallLLM
        .mockResolvedValueOnce(JSON.stringify({
          prefixes: ['modules/api/', 'invalid1/']
        }))
        .mockResolvedValueOnce(JSON.stringify({
          prefixes: ['modules/service/', 'invalid2/']
        }))
        .mockResolvedValueOnce(JSON.stringify({
          prefixes: ['modules/model/', 'invalid3/']
        }));

      (mockProjectTree.getFiles as jest.Mock).mockReturnValue([]);
      (mockProjectTree.pickByPrefix as jest.Mock)
        // Attempt 1
        .mockReturnValueOnce([{ relativePath: 'modules/api/User.java' }])  // valid
        .mockReturnValueOnce([])  // invalid
        // Attempt 2
        .mockReturnValueOnce([{ relativePath: 'modules/service/BookmarkReader.java' }])  // valid
        .mockReturnValueOnce([])  // invalid
        // Attempt 3
        .mockReturnValueOnce([{ relativePath: 'modules/model/User.java' }])  // valid
        .mockReturnValueOnce([]);  // invalid

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await detailedAnalysis(
        'tree',
        mockProjectTree,
        configFiles,
        prelimResult
      );

      expect(mockCallLLM).toHaveBeenCalledTimes(3);
      expect(result.prefixes).toEqual(['modules/model/']);  // Only last valid prefix
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Max attempts reached')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('fallback to global after max retries', () => {
    it('should fallback to global [""] when all attempts fail', async () => {
      // All 3 attempts return invalid prefixes
      mockCallLLM.mockResolvedValue(JSON.stringify({
        prefixes: ['invalid/']
      }));

      (mockProjectTree.getFiles as jest.Mock).mockReturnValue([]);
      (mockProjectTree.pickByPrefix as jest.Mock).mockReturnValue([]);  // Always invalid

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await detailedAnalysis(
        'tree',
        mockProjectTree,
        configFiles,
        prelimResult
      );

      expect(mockCallLLM).toHaveBeenCalledTimes(3);
      expect(result.prefixes).toEqual(['']);  // Fallback to global
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No valid prefixes found. Defaulting to global rules')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('LLM interaction', () => {
    it('should call LLM with correct prompts', async () => {
      mockCallLLM.mockResolvedValue(JSON.stringify({
        prefixes: ['modules/api/']
      }));

      (mockProjectTree.getFiles as jest.Mock).mockReturnValue([]);
      (mockProjectTree.pickByPrefix as jest.Mock).mockReturnValue([
        { relativePath: 'modules/api/User.java' }
      ]);

      await detailedAnalysis(
        'tree string',
        mockProjectTree,
        configFiles,
        prelimResult,
        'gpt-5.1-2025-11-13',
        false
      );

      expect(mockCallLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('software architect'),
          userPrompt: expect.stringContaining('tree string'),
          model: 'gpt-5.1-2025-11-13',
          temperature: 0.1,
          jsonMode: true
        })
      );
    });

    it('should include config files in user prompt', async () => {
      mockCallLLM.mockResolvedValue(JSON.stringify({ prefixes: [''] }));

      (mockProjectTree.getFiles as jest.Mock).mockReturnValue([]);
      (mockProjectTree.pickByPrefix as jest.Mock).mockReturnValue([{ relativePath: 'src/main.java' }]);

      await detailedAnalysis(
        'tree',
        mockProjectTree,
        configFiles,
        prelimResult
      );

      expect(mockCallLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          userPrompt: expect.stringContaining('build.gradle.kts')
        })
      );
    });

    it('should include preliminary result in user prompt', async () => {
      mockCallLLM.mockResolvedValue(JSON.stringify({ prefixes: [''] }));

      (mockProjectTree.getFiles as jest.Mock).mockReturnValue([]);
      (mockProjectTree.pickByPrefix as jest.Mock).mockReturnValue([{ relativePath: 'src/main.java' }]);

      await detailedAnalysis(
        'tree',
        mockProjectTree,
        configFiles,
        prelimResult
      );

      const callArgs = mockCallLLM.mock.calls[0][0];
      expect(callArgs.userPrompt).toContain('java');
      expect(callArgs.userPrompt).toContain('hexagonal');
    });
  });

  describe('user request and previous result', () => {
    it('should include user request in prompt when provided', async () => {
      mockCallLLM.mockResolvedValue(JSON.stringify({ prefixes: ['modules/api/'] }));

      (mockProjectTree.getFiles as jest.Mock).mockReturnValue([]);
      (mockProjectTree.pickByPrefix as jest.Mock).mockReturnValue([
        { relativePath: 'modules/api/User.java' }
      ]);

      await detailedAnalysis(
        'tree',
        mockProjectTree,
        configFiles,
        prelimResult,
        'gpt-5.1-2025-11-13',
        false,
        'Please focus on API layer'  // ← user request
      );

      expect(mockCallLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          userPrompt: expect.stringContaining('Please focus on API layer')
        })
      );
    });

    it('should include previous result in prompt when provided', async () => {
      mockCallLLM.mockResolvedValue(JSON.stringify({ prefixes: ['modules/api/'] }));

      (mockProjectTree.getFiles as jest.Mock).mockReturnValue([]);
      (mockProjectTree.pickByPrefix as jest.Mock).mockReturnValue([
        { relativePath: 'modules/api/User.java' }
      ]);

      const previousResult = { prefixes: ['modules/'] };

      await detailedAnalysis(
        'tree',
        mockProjectTree,
        configFiles,
        prelimResult,
        'gpt-5.1-2025-11-13',
        false,
        undefined,
        previousResult  // ← previous result
      );

      const callArgs = mockCallLLM.mock.calls[0][0];
      expect(callArgs.userPrompt).toContain('이전 분석 결과');
      expect(callArgs.userPrompt).toContain('modules/');
    });
  });
});
