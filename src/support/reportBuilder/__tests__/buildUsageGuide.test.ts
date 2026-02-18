import { buildUsageGuide, RuleFileInfo } from '../buildUsageGuide';

describe('buildUsageGuide', () => {
  describe('basic structure', () => {
    it('should generate valid markdown with global rules', () => {
      const ruleFiles: RuleFileInfo[] = [
        { prefix: 'src/api/', filename: 'src-api.md' },
        { prefix: 'src/domain/', filename: 'src-domain.md' }
      ];

      const result = buildUsageGuide(ruleFiles, true);

      // Verify markdown structure
      expect(result).toContain('# Generated Rules 사용 가이드');
      expect(result).toContain('## 📁 생성된 파일');
      expect(result).toContain('## 🎯 사용 방법');
      expect(result).toContain('## 💡 권장 워크플로우');
      expect(result).toContain('## 📝 수정 및 커스터마이징');
      expect(result).toContain('## 🔄 재생성');
      expect(result).toContain('## 🆘 문제 해결');
    });

    it('should include global.md when hasGlobalRules is true', () => {
      const ruleFiles: RuleFileInfo[] = [
        { prefix: 'src/api/', filename: 'src-api.md' }
      ];

      const result = buildUsageGuide(ruleFiles, true);

      expect(result).toContain('**global.md** - 전역 공통 규칙 (모든 파일에 적용)');
    });

    it('should not include global.md when hasGlobalRules is false', () => {
      const ruleFiles: RuleFileInfo[] = [
        { prefix: 'src/api/', filename: 'src-api.md' }
      ];

      const result = buildUsageGuide(ruleFiles, false);

      expect(result).not.toContain('**global.md**');
    });
  });

  describe('file list section', () => {
    it('should list all rule files with prefix display names', () => {
      const ruleFiles: RuleFileInfo[] = [
        { prefix: 'src/api/', filename: 'src-api.md' },
        { prefix: 'src/domain/model/', filename: 'src-domain-model.md' }
      ];

      const result = buildUsageGuide(ruleFiles, false);

      expect(result).toContain('**src-api.md** - src › api 모듈 가이드');
      expect(result).toContain('**src-domain-model.md** - src › domain › model 모듈 가이드');
    });

    it('should display root for empty prefix', () => {
      const ruleFiles: RuleFileInfo[] = [
        { prefix: '', filename: 'root.md' }
      ];

      const result = buildUsageGuide(ruleFiles, false);

      expect(result).toContain('**root.md** - root 모듈 가이드');
    });
  });

  describe('path mapping examples', () => {
    it('should generate correct path patterns', () => {
      const ruleFiles: RuleFileInfo[] = [
        { prefix: 'src/api/', filename: 'src-api.md' },
        { prefix: 'src/domain/', filename: 'src-domain.md' }
      ];

      const result = buildUsageGuide(ruleFiles, false);

      expect(result).toContain('`src/api/**/*`: `.claude/rules/src-api.md` 참고');
      expect(result).toContain('`src/domain/**/*`: `.claude/rules/src-domain.md` 참고');
    });

    it('should handle empty prefix with **/* pattern', () => {
      const ruleFiles: RuleFileInfo[] = [
        { prefix: '', filename: 'root.md' }
      ];

      const result = buildUsageGuide(ruleFiles, false);

      expect(result).toContain('`**/*`: `.claude/rules/root.md` 참고');
    });
  });

  describe('skill conversion examples', () => {
    it('should generate skill conversion commands for first 2 files', () => {
      const ruleFiles: RuleFileInfo[] = [
        { prefix: 'src/api/', filename: 'src-api.md' },
        { prefix: 'src/domain/', filename: 'src-domain.md' },
        { prefix: 'src/infra/', filename: 'src-infra.md' }
      ];

      const result = buildUsageGuide(ruleFiles, false);

      // Should include first 2 files
      expect(result).toContain('cp .claude/rules/src-api.md .claude/skills/src-api-guide.md');
      expect(result).toContain('cp .claude/rules/src-domain.md .claude/skills/src-domain-guide.md');

      // Should not include 3rd file
      expect(result).not.toContain('src-infra-guide.md');
    });

    it('should handle single file', () => {
      const ruleFiles: RuleFileInfo[] = [
        { prefix: 'src/api/', filename: 'src-api.md' }
      ];

      const result = buildUsageGuide(ruleFiles, false);

      expect(result).toContain('cp .claude/rules/src-api.md .claude/skills/src-api-guide.md');
    });

    it('should handle empty array', () => {
      const ruleFiles: RuleFileInfo[] = [];

      const result = buildUsageGuide(ruleFiles, false);

      // Should still generate valid markdown (just no examples)
      expect(result).toContain('# Generated Rules 사용 가이드');
    });
  });

  describe('complete integration', () => {
    it('should generate complete guide for complex project', () => {
      const ruleFiles: RuleFileInfo[] = [
        { prefix: 'modules/api/', filename: 'modules-api.md' },
        { prefix: 'modules/service/', filename: 'modules-service.md' },
        { prefix: 'modules/domain/model/', filename: 'modules-domain-model.md' },
        { prefix: 'modules/infra/', filename: 'modules-infra.md' }
      ];

      const result = buildUsageGuide(ruleFiles, true);

      // Verify all sections present
      expect(result).toContain('global.md');
      expect(result).toContain('modules-api.md');
      expect(result).toContain('modules-service.md');
      expect(result).toContain('modules-domain-model.md');
      expect(result).toContain('modules-infra.md');

      // Verify path mappings
      expect(result).toContain('modules/api/**/*');
      expect(result).toContain('modules/domain/model/**/*');

      // Verify skill examples (first 2)
      expect(result).toContain('modules-api-guide.md');
      expect(result).toContain('modules-service-guide.md');
    });

    it('should handle single module project', () => {
      const ruleFiles: RuleFileInfo[] = [];

      const result = buildUsageGuide(ruleFiles, true);

      expect(result).toContain('global.md');
      expect(result).toContain('# Generated Rules 사용 가이드');
    });
  });

  describe('content validation', () => {
    it('should include troubleshooting section', () => {
      const result = buildUsageGuide([], false);

      expect(result).toContain('## 🆘 문제 해결');
      expect(result).toContain('Q: 생성된 가이드가 너무 길어요');
      expect(result).toContain('Q: 패턴이 프로젝트와 맞지 않아요');
      expect(result).toContain('Q: Claude Code가 rules를 안 읽어요');
    });

    it('should include workflow recommendations', () => {
      const result = buildUsageGuide([], false);

      expect(result).toContain('## 💡 권장 워크플로우');
      expect(result).toContain('작업 시작 전');
      expect(result).toContain('코드 작성 시');
      expect(result).toContain('유연하게 적용');
    });

    it('should include regeneration instructions', () => {
      const result = buildUsageGuide([], false);

      expect(result).toContain('## 🔄 재생성');
      expect(result).toContain('reporules analyze . --output .claude');
    });
  });
});
