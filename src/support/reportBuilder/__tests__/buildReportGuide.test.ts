import { buildReportGuide, AnalysisReport, SegmentReport } from '../buildReportGuide';

describe('buildReportGuide', () => {
  const baseReport: AnalysisReport = {
    projectPath: '/path/to/project',
    totalFiles: 100,
    totalSegments: 5,
    analyzedSegments: 4,
    segmentReports: [],
    timestamp: '2025-02-15 10:00:00'
  };

  describe('basic structure', () => {
    it('should generate valid markdown with all sections', () => {
      const report: AnalysisReport = {
        ...baseReport,
        segmentReports: [
          { prefix: 'src/api/', status: 'success', type: 'template-based', lines: 150, filename: 'src-api.md' }
        ]
      };

      const result = buildReportGuide(report);

      expect(result).toContain('# RepoRules 분석 리포트');
      expect(result).toContain('## 프로젝트 구조 분석');
      expect(result).toContain('## 모듈 구분');
      expect(result).toContain('## 주의사항');
      expect(result).toContain('## 가이드 활용 팁');
    });

    it('should include timestamp and project path', () => {
      const result = buildReportGuide(baseReport);

      expect(result).toContain('생성 일시: 2025-02-15 10:00:00');
      expect(result).toContain('프로젝트: /path/to/project');
    });
  });

  describe('single module project', () => {
    it('should display single module message when totalSegments <= 1', () => {
      const report: AnalysisReport = {
        ...baseReport,
        totalSegments: 1,
        segmentReports: []
      };

      const result = buildReportGuide(report);

      expect(result).toContain('단일 모듈(구획)로 판단됩니다');
      expect(result).toContain('총 파일 수: 100');
      expect(result).toContain('생성된 규칙: global.md');
    });
  });

  describe('multi-module project', () => {
    it('should list all segments with their types', () => {
      const report: AnalysisReport = {
        ...baseReport,
        totalSegments: 4,
        segmentReports: [
          { prefix: 'src/api/', status: 'success', type: 'template-based', lines: 150, filename: 'src-api.md' },
          { prefix: 'src/domain/', status: 'success', type: 'decomposed', lines: 180, filename: 'src-domain.md' },
          { prefix: 'src/utils/', status: 'skipped', reason: 'flat' },
          { prefix: 'src/legacy/', status: 'failed' }
        ]
      };

      const result = buildReportGuide(report);

      expect(result).toContain('4개의 구획(모듈)로 나눠서 분석합니다');
      expect(result).toContain('src/api/ (template-based)');
      expect(result).toContain('src/domain/ (decomposed)');
      expect(result).toContain('src/utils/ (flat)');
      expect(result).toContain('src/legacy/ (failed)');
      expect(result).toContain('생성된 규칙: 2개 + global.md');
    });

    it('should mark long guides (>200 lines)', () => {
      const report: AnalysisReport = {
        ...baseReport,
        segmentReports: [
          { prefix: 'src/api/', status: 'success', type: 'template-based', lines: 250, filename: 'src-api.md' }
        ]
      };

      const result = buildReportGuide(report);

      expect(result).toContain('src/api/ (template-based) [200줄 초과]');
    });
  });

  describe('module classification', () => {
    it('should categorize flat modules correctly', () => {
      const report: AnalysisReport = {
        ...baseReport,
        segmentReports: [
          { prefix: 'src/utils/', status: 'skipped', reason: 'flat' },
          { prefix: 'src/helpers/', status: 'skipped', reason: 'flat' }
        ]
      };

      const result = buildReportGuide(report);

      expect(result).toContain('### flat');
      expect(result).toContain('- src/utils/');
      expect(result).toContain('- src/helpers/');
    });

    it('should categorize template modules correctly', () => {
      const report: AnalysisReport = {
        ...baseReport,
        segmentReports: [
          { prefix: 'src/api/', status: 'success', type: 'template-based', lines: 150, filename: 'src-api.md' },
          { prefix: 'src/domain/', status: 'success', type: 'template-based', lines: 160, filename: 'src-domain.md' }
        ]
      };

      const result = buildReportGuide(report);

      expect(result).toContain('### template');
      expect(result).toContain('- src/api/');
      expect(result).toContain('- src/domain/');
    });

    it('should categorize decomposed modules correctly', () => {
      const report: AnalysisReport = {
        ...baseReport,
        segmentReports: [
          { prefix: 'src/complex/', status: 'success', type: 'decomposed', lines: 170, filename: 'src-complex.md' }
        ]
      };

      const result = buildReportGuide(report);

      expect(result).toContain('### decomposed');
      expect(result).toContain('- src/complex/');
    });

    it('should show (해당 없음) when no modules in category', () => {
      const report: AnalysisReport = {
        ...baseReport,
        segmentReports: [
          { prefix: 'src/api/', status: 'success', type: 'template-based', lines: 150, filename: 'src-api.md' }
        ]
      };

      const result = buildReportGuide(report);

      expect(result).toContain('### flat');
      expect(result).toContain('(해당 없음)');
      expect(result).toContain('### decomposed');
      expect(result).toContain('(해당 없음)');
    });
  });

  describe('warnings section', () => {
    it('should list guides exceeding 200 lines', () => {
      const report: AnalysisReport = {
        ...baseReport,
        segmentReports: [
          { prefix: 'src/api/', status: 'success', type: 'template-based', lines: 250, filename: 'src-api.md' },
          { prefix: 'src/domain/', status: 'success', type: 'template-based', lines: 300, filename: 'src-domain.md' },
          { prefix: 'src/infra/', status: 'success', type: 'template-based', lines: 150, filename: 'src-infra.md' }
        ]
      };

      const result = buildReportGuide(report);

      expect(result).toContain('### 200줄 초과 가이드 (2개)');
      expect(result).toContain('`src-api.md`: 250줄');
      expect(result).toContain('`src-domain.md`: 300줄');
      expect(result).not.toContain('`src-infra.md`');
    });

    it('should show no warnings when all guides are under 200 lines', () => {
      const report: AnalysisReport = {
        ...baseReport,
        segmentReports: [
          { prefix: 'src/api/', status: 'success', type: 'template-based', lines: 150, filename: 'src-api.md' }
        ]
      };

      const result = buildReportGuide(report);

      expect(result).toContain('모든 가이드가 200줄 이하입니다');
    });

    it('should list failed segments', () => {
      const report: AnalysisReport = {
        ...baseReport,
        segmentReports: [
          { prefix: 'src/api/', status: 'failed' },
          { prefix: 'src/domain/', status: 'failed' }
        ]
      };

      const result = buildReportGuide(report);

      expect(result).toContain('### 실패한 세그먼트 (2개)');
      expect(result).toContain('- src/api/');
      expect(result).toContain('- src/domain/');
      expect(result).toContain('LLM 오류 또는 타임아웃으로 생성에 실패했습니다');
    });

    it('should not show failed section when no failures', () => {
      const report: AnalysisReport = {
        ...baseReport,
        segmentReports: [
          { prefix: 'src/api/', status: 'success', type: 'template-based', lines: 150, filename: 'src-api.md' }
        ]
      };

      const result = buildReportGuide(report);

      expect(result).not.toContain('실패한 세그먼트');
    });
  });

  describe('usage tips section', () => {
    it('should include path mapping examples for Claude Code', () => {
      const report: AnalysisReport = {
        ...baseReport,
        segmentReports: [
          { prefix: 'src/api/', status: 'success', type: 'template-based', lines: 150, filename: 'src-api.md' },
          { prefix: 'src/domain/', status: 'success', type: 'template-based', lines: 160, filename: 'src-domain.md' }
        ]
      };

      const result = buildReportGuide(report);

      expect(result).toContain('/src/api/** -> .claude/rules/src-api.md');
      expect(result).toContain('/src/domain/** -> .claude/rules/src-domain.md');
    });

    it('should handle trailing slash in prefix', () => {
      const report: AnalysisReport = {
        ...baseReport,
        segmentReports: [
          { prefix: 'src/api/', status: 'success', type: 'template-based', lines: 150, filename: 'src-api.md' }
        ]
      };

      const result = buildReportGuide(report);

      expect(result).toContain('/src/api/**');
    });

    it('should handle prefix without trailing slash', () => {
      const report: AnalysisReport = {
        ...baseReport,
        segmentReports: [
          { prefix: 'src/api', status: 'success', type: 'template-based', lines: 150, filename: 'src-api.md' }
        ]
      };

      const result = buildReportGuide(report);

      expect(result).toContain('/src/api/**');
    });

    it('should show message when no rules generated', () => {
      const report: AnalysisReport = {
        ...baseReport,
        segmentReports: []
      };

      const result = buildReportGuide(report);

      expect(result).toContain('생성된 규칙 파일이 없습니다');
    });
  });

  describe('complete integration', () => {
    it('should generate complete report for complex project', () => {
      const report: AnalysisReport = {
        projectPath: '/Users/dev/my-project',
        totalFiles: 500,
        totalSegments: 8,
        analyzedSegments: 6,
        timestamp: '2025-02-15 14:30:00',
        segmentReports: [
          { prefix: 'src/api/', status: 'success', type: 'template-based', lines: 180, filename: 'src-api.md' },
          { prefix: 'src/domain/', status: 'success', type: 'decomposed', lines: 250, filename: 'src-domain.md' },
          { prefix: 'src/infra/', status: 'success', type: 'template-based', lines: 160, filename: 'src-infra.md' },
          { prefix: 'src/utils/', status: 'skipped', reason: 'flat' },
          { prefix: 'src/legacy/', status: 'failed' }
        ]
      };

      const result = buildReportGuide(report);

      // Basic info
      expect(result).toContain('2025-02-15 14:30:00');
      expect(result).toContain('/Users/dev/my-project');

      // Structure
      expect(result).toContain('8개의 구획(모듈)');
      expect(result).toContain('생성된 규칙: 3개 + global.md');

      // Module types
      expect(result).toContain('template');
      expect(result).toContain('decomposed');
      expect(result).toContain('flat');

      // Warnings
      expect(result).toContain('200줄 초과 가이드 (1개)');
      expect(result).toContain('`src-domain.md`: 250줄');
      expect(result).toContain('실패한 세그먼트 (1개)');

      // Usage tips
      expect(result).toContain('/src/api/** -> .claude/rules/src-api.md');
    });
  });
});
