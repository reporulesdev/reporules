
import { AnalyzeOptions, RuleFile } from './types';
import { ANALYSIS_CONFIG } from './constants';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import * as p from '@clack/prompts';
import { validateLLMConfig } from '../../client/config';
import { ProjectTree } from '../../support/projectTree';
import { buildReportGuide, SegmentReport } from '../../support/reportBuilder/buildReportGuide';
import { buildUsageGuide } from '../../support/reportBuilder/buildUsageGuide';
import { generateSkills, SkillEntry } from '../../support/llm/generateSkills';
import { detectProjects } from '../../support/llm/detectProjects';
import { detectProjectMeta } from '../../support/llm/detectProjectMeta';
import { segmentProject } from '../../support/llm/segmentProject';
import { PreliminaryAnalysisResult } from '../../data/types';
import { generateAllSegmentRules } from './segmentProcessor';

/**
 * Main workflow: Analyze project and generate rules
 * 프로젝트를 분석하고 rules/skills를 생성하는 메인 워크플로우
 */
export async function analyzeProject(options: AnalyzeOptions): Promise<void> {
  const { projectPath, outputDir } = options;

  console.log('━'.repeat(60));
  console.log('RepoRules: Analyzing Project');
  console.log('━'.repeat(60));
  console.log();

  if (!existsSync(projectPath)) {
    throw new Error(`Project path not found: ${projectPath}`);
  }

  validateLLMConfig();

  // Step 0: Detect and select project
  const actualProjectPath = await detectAndSelectProject(projectPath);

  console.log('📊 Analyzing project structure...');
  console.log(`   Path: ${actualProjectPath}`);
  const tree = new ProjectTree(actualProjectPath);
  const treeString = tree.toTreeString();
  const stats = tree.getStats();
  console.log(`   Found ${stats.totalFiles} files, ${stats.totalDirs} directories`);
  console.log();

  // Step 1: Detect language, architecture, complexity
  const { prelimResult, configFiles } = await runMetaDetection(treeString, projectPath);

  // Step 2: Split project into segment prefixes
  const prefixes = await runSegmentation(treeString, tree, configFiles, prelimResult);

  // Step 2.5: Let user choose which segments to analyze
  const selectedPrefixes = await selectSegments(prefixes, tree);

  // Step 3: Generate rules per segment (parallel)
  const rulesDir = join(actualProjectPath, outputDir, 'rules');
  if (!existsSync(rulesDir)) {
    mkdirSync(rulesDir, { recursive: true });
  }

  const { ruleFiles, segmentReports } = await generateAllSegmentRules(
    selectedPrefixes,
    tree,
    actualProjectPath,
    prelimResult,
    rulesDir,
    options.experimental ?? false,
    options.includeSmall ?? false
  );

  // Step 4: Generate skills from rules
  console.log('🛠️  Step 4: Generating skills...');
  const projectName = basename(actualProjectPath);
  const skills = await generateSkills(
    treeString,
    ruleFiles,
    projectName,
    ANALYSIS_CONFIG.DEFAULT_MODEL,
    false
  );
  console.log(`   Generated ${skills.length} skill(s)`);
  console.log();

  // Step 5: Save results
  await saveAnalysisResults(
    rulesDir,
    outputDir,
    ruleFiles,
    skills,
    stats,
    prefixes,
    selectedPrefixes,
    segmentReports,
    actualProjectPath
  );

  printAnalysisSummary(actualProjectPath, stats, prefixes, ruleFiles, skills, outputDir);
}

/**
 * Step 0: Detect sub-projects and let user select one
 * 하위 프로젝트를 감지하고 사용자가 선택하게 함
 */
async function detectAndSelectProject(projectPath: string): Promise<string> {
  console.log('📊 Step 0: Detecting projects...');

  const initialTree = new ProjectTree(projectPath, { maxDepth: ANALYSIS_CONFIG.INITIAL_TREE_DEPTH });
  const initialTreeString = initialTree.toTreeString(ANALYSIS_CONFIG.INITIAL_TREE_DEPTH);

  const detection = await detectProjects(initialTreeString);

  let actualProjectPath = projectPath;

  if (!detection.isSingleProject && detection.projects.length > 1) {
    console.log(`   Found ${detection.projects.length} projects:`);
    console.log();

    for (let i = 0; i < detection.projects.length; i++) {
      const proj = detection.projects[i];
      console.log(`   ${i + 1}. ${proj.path} - ${proj.description}`);
      if (proj.warning) {
        console.log(`      ⚠️  ${proj.warning}`);
      }
    }
    console.log();

    const choices = detection.projects.map((proj, idx) => ({
      value: proj.path,
      label: `${proj.name} (${proj.path})`,
      hint: proj.description
    }));

    choices.push({
      value: '.',
      label: 'Entire directory (not recommended)',
      hint: 'Analyze all projects together'
    });

    const selected = await p.select({
      message: 'Select project to analyze:',
      options: choices,
    });

    if (p.isCancel(selected)) {
      p.cancel('Analysis cancelled.');
      process.exit(0);
    }

    if (selected !== '.') {
      actualProjectPath = join(projectPath, selected as string);
      console.log();
      console.log(`   Selected: ${selected}`);
      console.log();
    }
  } else {
    console.log(`   Single project detected: ${detection.projects[0]?.description || 'Unknown'}`);
    if (detection.projects[0]?.warning) {
      console.log(`   ⚠️  ${detection.projects[0].warning}`);
    }
    console.log();
  }

  return actualProjectPath;
}

/**
 * Step 1: Detect project meta (language, architecture) and read config files
 * 언어·아키텍처를 감지하고 설정 파일을 읽음
 */
async function runMetaDetection(
  treeString: string,
  projectPath: string
): Promise<{
  prelimResult: PreliminaryAnalysisResult;
  configFiles: Map<string, string>;
}> {
  console.log('🤖 Step 1: Running preliminary analysis...');

  const prelimResult = await detectProjectMeta(treeString);
  console.log(`   Language: ${prelimResult.language}`);
  console.log(`   Architecture: ${prelimResult.architecturePattern}`);
  console.log(`   Complexity: ${prelimResult.complexity}`);
  console.log();

  const configFiles = await readConfigFiles(prelimResult.filesToRead, projectPath);

  return { prelimResult, configFiles };
}

/**
 * Step 2: Split project tree into segment prefixes
 * 프로젝트 트리를 세그먼트 prefix로 분할
 */
async function runSegmentation(
  treeString: string,
  tree: ProjectTree,
  configFiles: Map<string, string>,
  prelimResult: PreliminaryAnalysisResult
): Promise<string[]> {
  console.log('🔍 Step 2: Segmenting project...');

  const detailedResult = await segmentProject(treeString, tree, configFiles, prelimResult);

  const prefixes = detailedResult.prefixes;
  console.log(`   Found ${prefixes.length} segment(s)`);
  console.log();

  return prefixes;
}

/**
 * Step 2.5: Let user select which segments to analyze
 * 분석할 세그먼트를 사용자가 선택하게 함
 */
async function selectSegments(
  prefixes: string[],
  tree: ProjectTree
): Promise<string[]> {
  let selectedPrefixes = prefixes;

  const nonGlobalPrefixes = prefixes.filter(p => p !== '');

  if (nonGlobalPrefixes.length > 1) {
    console.log('📋 Select segments to analyze (for cost optimization):');
    console.log();

    const prefixChoices = nonGlobalPrefixes.map(prefix => {
      const prefixFiles = tree.pickByPrefix(prefix);
      const fileCount = prefixFiles.filter(f => f.type === 'file').length;
      return { value: prefix, label: prefix, hint: `${fileCount} files` };
    });

    prefixChoices.unshift({
      value: '__ALL__',
      label: 'All segments (recommended)',
      hint: 'Analyze all segments'
    });

    const selection = await p.multiselect({
      message: 'Which segments do you want to analyze?',
      options: prefixChoices,
      required: false,
    });

    if (p.isCancel(selection)) {
      p.cancel('Analysis cancelled.');
      process.exit(0);
    }

    if (Array.isArray(selection) && selection.length > 0) {
      selectedPrefixes = selection.includes('__ALL__')
        ? prefixes
        : ['', ...selection as string[]];
      console.log();
      console.log(`   Selected ${selectedPrefixes.filter(p => p !== '').length} segment(s)`);
      console.log();
    } else {
      selectedPrefixes = prefixes;
    }
  }

  return selectedPrefixes;
}

/**
 * Step 5: Write rules, skills, USAGE.md, and report.md to disk
 * rules, skills, USAGE.md, report.md를 디스크에 저장
 */
async function saveAnalysisResults(
  rulesDir: string,
  outputDir: string,
  ruleFiles: RuleFile[],
  skills: SkillEntry[],
  stats: { totalFiles: number; totalDirs: number },
  prefixes: string[],
  selectedPrefixes: string[],
  segmentReports: SegmentReport[],
  actualProjectPath: string
): Promise<void> {
  console.log('💾 Step 5: Saving results...');

  if (skills.length > 0) {
    const skillsDir = join(actualProjectPath, outputDir, 'skills');
    if (!existsSync(skillsDir)) {
      mkdirSync(skillsDir, { recursive: true });
    }
    for (const skill of skills) {
      writeFileSync(join(skillsDir, `${skill.title}.md`), skill.content);
      console.log(`   Saved: ${outputDir}/skills/${skill.title}.md`);
    }
  }

  const hasGlobalRules = ruleFiles.some(r => r.filename === 'global.md');
  const usageContent = buildUsageGuide(ruleFiles, hasGlobalRules, skills);
  writeFileSync(join(actualProjectPath, outputDir, 'USAGE.md'), usageContent);
  console.log(`   Saved: ${outputDir}/USAGE.md`);

  // report.md goes to outputDir root, not inside rules/
  const reportContent = buildReportGuide({
    projectPath: actualProjectPath,
    totalFiles: stats.totalFiles,
    totalSegments: prefixes.length,
    analyzedSegments: selectedPrefixes.filter(p => p !== '').length,
    segmentReports: segmentReports,
    timestamp: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
  });
  writeFileSync(join(actualProjectPath, outputDir, 'report.md'), reportContent);
  console.log(`   Saved: ${outputDir}/report.md`);

  console.log();
}

/**
 * Read config files listed in preliminary analysis result
 * 사전 분석 결과에서 지정한 설정 파일들을 읽음
 */
async function readConfigFiles(
  filePaths: string[],
  projectPath: string
): Promise<Map<string, string>> {
  const configFiles = new Map<string, string>();

  for (const filePath of filePaths) {
    const fullPath = join(projectPath, filePath);
    if (existsSync(fullPath)) {
      try {
        const content = readFileSync(fullPath, 'utf-8');
        configFiles.set(filePath, content);
      } catch {
        // skip unreadable files
      }
    }
  }

  return configFiles;
}

/**
 * Print final analysis summary to console
 * 분석 완료 요약을 콘솔에 출력
 */
function printAnalysisSummary(
  actualProjectPath: string,
  stats: { totalFiles: number; totalDirs: number },
  prefixes: string[],
  ruleFiles: Array<{ prefix: string; filename: string }>,
  skills: SkillEntry[],
  outputDir: string
): void {
  console.log('━'.repeat(60));
  console.log('✅ Analysis Complete!');
  console.log('━'.repeat(60));
  console.log();
  console.log('Summary:');
  console.log(`  Project: ${actualProjectPath}`);
  console.log(`  Files analyzed: ${stats.totalFiles}`);
  console.log(`  Segments: ${prefixes.length}`);
  console.log(`  Rules generated: ${ruleFiles.length}`);
  console.log(`  Skills generated: ${skills.length}`);
  console.log();

  console.log(`Rules saved to:  ${outputDir}/rules/`);
  if (skills.length > 0) {
    console.log(`Skills saved to: ${outputDir}/skills/`);
  }
  console.log(`USAGE saved to:  ${outputDir}/USAGE.md`);
  console.log(`Report saved to: ${outputDir}/report.md`);
  console.log();
  console.log('Next steps:');
  console.log(`  1. 📊 Check: ${outputDir}/report.md`);
  console.log('     분석 결과, 세그먼트 타입, 주의사항 확인');
  console.log(`  2. 📖 Check: ${outputDir}/USAGE.md`);
  console.log('     rules/skills 적용 방법 확인');
  console.log('  3. Review the generated rules');
  console.log(`  4. Apply to your AI tool's rules (e.g. .cursor/rules/, CLAUDE.md)`);
  console.log('  5. Start coding with AI assistance!');
  console.log();
}
