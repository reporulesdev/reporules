import { deduplicateFilePatterns } from '../patternDeduplicator';

describe('patternDeduplicator', () => {
  describe('deduplicateFilePatterns', () => {
    it('should keep all root-level files', () => {
      const files = [
        'package.json',
        'build.gradle.kts',
        'settings.gradle.kts',
        'pnpm-workspace.yaml',
      ];

      const result = deduplicateFilePatterns(files);

      expect(result).toEqual(files);
      expect(result.length).toBe(4);
    });

    it('should keep all files when no pattern has 10+ instances', () => {
      const files = [
        'package.json',
        'modules/api/build.gradle.kts',
        'modules/service/build.gradle.kts',
        'modules/core/build.gradle.kts',
      ];

      const result = deduplicateFilePatterns(files);

      expect(result).toEqual(files);
      expect(result.length).toBe(4);
    });

    it('should deduplicate when pattern has 10+ instances', () => {
      const files = [
        'package.json',
        'extensions/discord/package.json',
        'extensions/slack/package.json',
        'extensions/telegram/package.json',
        'extensions/teams/package.json',
        'extensions/zoom/package.json',
        'extensions/webex/package.json',
        'extensions/skype/package.json',
        'extensions/messenger/package.json',
        'extensions/whatsapp/package.json',
        'extensions/line/package.json',
        'extensions/kakao/package.json', // 11th file
        'extensions/wechat/package.json',
      ];

      const result = deduplicateFilePatterns(files);

      // Root file + 3 representatives from extensions
      expect(result.length).toBe(4);
      expect(result).toContain('package.json');
      expect(result).toContain('extensions/discord/package.json');
      expect(result).toContain('extensions/slack/package.json');
      expect(result).toContain('extensions/telegram/package.json');
    });

    it('should handle multiple pattern groups independently', () => {
      const files = [
        'package.json',
        // Group 1: extensions/*/package.json (12 files - should be reduced)
        'extensions/discord/package.json',
        'extensions/slack/package.json',
        'extensions/telegram/package.json',
        'extensions/teams/package.json',
        'extensions/zoom/package.json',
        'extensions/webex/package.json',
        'extensions/skype/package.json',
        'extensions/messenger/package.json',
        'extensions/whatsapp/package.json',
        'extensions/line/package.json',
        'extensions/kakao/package.json',
        'extensions/wechat/package.json',
        // Group 2: apps/*/config.json (3 files - should be kept)
        'apps/frontend/config.json',
        'apps/backend/config.json',
        'apps/admin/config.json',
      ];

      const result = deduplicateFilePatterns(files);

      // 1 root + 3 extensions + 3 apps = 7 files
      expect(result.length).toBe(7);
      expect(result).toContain('package.json');
      // Extensions reduced to 3
      expect(
        result.filter((f) => f.startsWith('extensions/')).length
      ).toBe(3);
      // Apps kept all 3
      expect(result.filter((f) => f.startsWith('apps/')).length).toBe(3);
    });

    it('should handle deeply nested paths', () => {
      const files = [
        'package.json',
        'modules/api/src/config.ts',
        'modules/service/src/config.ts',
        'modules/core/src/config.ts',
      ];

      const result = deduplicateFilePatterns(files);

      // All kept (< 10 instances)
      expect(result.length).toBe(4);
    });

    it('should handle real-world hard repo scenario', () => {
      // Simulate 50 extensions + other files
      const extensions = Array.from({ length: 50 }, (_, i) =>
        `extensions/ext${i}/package.json`
      );

      const files = [
        'package.json',
        'pnpm-workspace.yaml',
        ...extensions,
        'apps/frontend/package.json',
        'apps/backend/package.json',
      ];

      const result = deduplicateFilePatterns(files);

      // 2 root + 3 extensions + 2 apps = 7 files
      expect(result.length).toBe(7);
      expect(result).toContain('package.json');
      expect(result).toContain('pnpm-workspace.yaml');
      expect(result).toContain('apps/frontend/package.json');
      expect(result).toContain('apps/backend/package.json');
      // Extensions reduced from 50 to 3
      expect(
        result.filter((f) => f.startsWith('extensions/')).length
      ).toBe(3);
    });

    it('should preserve order of files', () => {
      const files = [
        'package.json',
        'extensions/a/package.json',
        'extensions/b/package.json',
        'extensions/c/package.json',
        'extensions/d/package.json',
        'extensions/e/package.json',
        'extensions/f/package.json',
        'extensions/g/package.json',
        'extensions/h/package.json',
        'extensions/i/package.json',
        'extensions/j/package.json',
        'extensions/k/package.json',
      ];

      const result = deduplicateFilePatterns(files);

      // Should keep first 3 extensions in order
      expect(result[0]).toBe('package.json');
      expect(result[1]).toBe('extensions/a/package.json');
      expect(result[2]).toBe('extensions/b/package.json');
      expect(result[3]).toBe('extensions/c/package.json');
    });
  });
});
