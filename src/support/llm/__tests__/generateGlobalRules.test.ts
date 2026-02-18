import {
  selectGlobalSampleFiles,
  generateGlobalRules,
  readGlobalSampleFiles
} from '../generateGlobalRules';
import { callLLM } from '../../../client/wrapper';
import { ProjectTree } from '../../projectTree';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('../../../client/wrapper');
jest.mock('fs');
jest.mock('../compressGlobalGuide', () => ({
  compressGlobalGuide: jest.fn((content) => Promise.resolve(`[COMPRESSED] ${content}`))
}));

const mockCallLLM = callLLM as jest.MockedFunction<typeof callLLM>;
const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

describe('generateGlobalRules', () => {
  let mockProjectTree: ProjectTree;

  beforeEach(() => {
    jest.clearAllMocks();

    mockProjectTree = {
      pickByPrefix: jest.fn(),
      toTreeString: jest.fn().mockReturnValue('mock/tree/structure'),
      getFiles: jest.fn().mockReturnValue([])
    } as any;
  });

  describe('selectGlobalSampleFiles', () => {
    it('should select 5-15 sample files from project', async () => {
      // Mock LLM response
      mockCallLLM.mockResolvedValue(JSON.stringify({
        selectedFiles: [
          'src/User.java',
          'src/Post.java',
          'src/service/BookmarkReader.java'
        ],
        reasoning: 'Selected diverse files across different modules'
      }));

      // Mock ProjectTree
      (mockProjectTree.pickByPrefix as jest.Mock).mockReturnValue([
        { relativePath: 'src/User.java', type: 'file' },
        { relativePath: 'src/Post.java', type: 'file' },
        { relativePath: 'src/service/BookmarkReader.java', type: 'file' },
        { relativePath: 'src/config/AppConfig.java', type: 'file' }
      ]);

      const result = await selectGlobalSampleFiles(mockProjectTree);

      expect(result).toHaveLength(3);
      expect(result).toContain('src/User.java');
      expect(result).toContain('src/Post.java');
      expect(result).toContain('src/service/BookmarkReader.java');
      expect(mockCallLLM).toHaveBeenCalledTimes(1);
    });

    it('should call LLM with project tree and statistics', async () => {
      mockCallLLM.mockResolvedValue(JSON.stringify({
        selectedFiles: ['src/User.java'],
        reasoning: 'Test'
      }));

      (mockProjectTree.pickByPrefix as jest.Mock).mockReturnValue([
        { relativePath: 'src/User.java', type: 'file' },
        { relativePath: 'src/Post.java', type: 'file' }
      ]);

      await selectGlobalSampleFiles(mockProjectTree, 'gpt-4o-mini', false);

      expect(mockCallLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('샘플 파일을 선택'),
          userPrompt: expect.stringContaining('총 2 파일'),
          model: 'gpt-4o-mini',
          temperature: 0.1,
          jsonMode: true
        })
      );
    });
  });

  describe('generateGlobalRules', () => {
    it('should generate and compress global rules document', async () => {
      // Mock LLM responses
      mockCallLLM
        .mockResolvedValueOnce('# Global Rules\n\nThis is a global rules document...')  // generateGlobalRules
        .mockResolvedValueOnce('[COMPRESSED] # Global Rules\n\nThis is a global rules document...');  // compressGlobalGuide (mocked above)

      const sampleFiles = [
        { path: 'User.java', content: 'class User {}', lines: 10 },
        { path: 'Post.java', content: 'class Post {}', lines: 15 }
      ];

      const prelimResult = {
        language: 'java',
        buildSystem: 'gradle',
        architecturePattern: 'hexagonal'
      } as any;

      const result = await generateGlobalRules(
        '/test-project',
        sampleFiles,
        prelimResult
      );

      expect(result).toContain('[COMPRESSED]');
      expect(result).toContain('Global Rules');
      expect(mockCallLLM).toHaveBeenCalledTimes(1);
    });

    it('should include project info in system prompt', async () => {
      mockCallLLM.mockResolvedValue('# Global Rules\n...');

      const prelimResult = {
        language: 'typescript',
        buildSystem: 'npm',
        architecturePattern: 'layered'
      } as any;

      await generateGlobalRules(
        '/test-project',
        [{ path: 'index.ts', content: 'export {}', lines: 5 }],
        prelimResult,
        'gpt-4o-mini'
      );

      const callArgs = mockCallLLM.mock.calls[0][0];
      expect(callArgs.systemPrompt).toContain('typescript');
      expect(callArgs.systemPrompt).toContain('npm');
      expect(callArgs.systemPrompt).toContain('layered');
      expect(callArgs.model).toBe('gpt-4o-mini');
      expect(callArgs.temperature).toBe(0.2);
    });
  });

  describe('readGlobalSampleFiles', () => {
    it('should read sample files from disk', async () => {
      // Mock fs.readFileSync
      mockReadFileSync
        .mockReturnValueOnce('public class User {\n  String name;\n}' as any)
        .mockReturnValueOnce('public class Post {\n  String title;\n}' as any);

      const result = await readGlobalSampleFiles(
        '/test-project',
        ['src/User.java', 'src/Post.java']
      );

      expect(result).toHaveLength(2);
      expect(result[0].path).toBe('src/User.java');
      expect(result[0].content).toContain('public class User');
      expect(result[0].lines).toBe(3);
      expect(result[1].path).toBe('src/Post.java');
      expect(result[1].content).toContain('public class Post');
      expect(result[1].lines).toBe(3);
    });

    it('should truncate files longer than 300 lines', async () => {
      // Create a file with 400 lines
      const longContent = Array(400).fill('line content').join('\n');
      mockReadFileSync.mockReturnValue(longContent as any);

      const result = await readGlobalSampleFiles('/test', ['long.java']);

      expect(result).toHaveLength(1);
      expect(result[0].lines).toBe(300);
      expect(result[0].content).toContain('... (truncated, 100 more lines)');
    });

    it('should handle file read errors gracefully', async () => {
      // Mock fs to throw error for second file
      mockReadFileSync.mockImplementation((filePath: any) => {
        if (filePath.includes('missing')) {
          throw new Error('File not found');
        }
        return 'class User {}' as any;
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await readGlobalSampleFiles(
        '/test',
        ['src/User.java', 'src/missing.java']
      );

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('src/User.java');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to read file: src/missing.java')
      );

      consoleSpy.mockRestore();
    });

    it('should return empty array when no file paths provided', async () => {
      const result = await readGlobalSampleFiles('/test', []);
      expect(result).toHaveLength(0);
      expect(mockReadFileSync).not.toHaveBeenCalled();
    });

    it('should use correct file paths with projectRoot', async () => {
      mockReadFileSync.mockReturnValue('content' as any);

      await readGlobalSampleFiles('/my-project', ['src/User.java']);

      expect(mockReadFileSync).toHaveBeenCalledWith(
        path.join('/my-project', 'src/User.java'),
        'utf-8'
      );
    });
  });
});
