
import { AnalyzeOptions, BatchResult, RuleFile } from './types';
import { ANALYSIS_CONFIG } from './constants';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import * as p from '@clack/prompts';
import {validateLLMConfig} from "../../client/config";
import {ProjectTree} from "../../support/projectTree";
import {buildReportGuide, SegmentReport} from "../../support/reportBuilder/buildReportGuide";
import {buildUsageGuide} from "../../support/reportBuilder/buildUsageGuide";
import {generateSkills, SkillEntry} from "../../support/llm/generateSkills";
import {detectProjects} from "../../support/llm/detectProjects";
import {preliminaryAnalysis} from "../../support/llm/preliminaryAnalysis";
import {detailedAnalysis} from "../../support/llm/detailedAnalysis";
import {
  selectMainFilesForSmallSegment,
  classifySmallSegmentType,
  generateRulesForSmallSegment
} from "../../support/llm/generateRules";
import {classifyStructured} from "../../support/llm/classifyStructured";
import {selectSampleFilesWithLLM} from "../../support/llm/selectSamples";
import {classifyPrefixStructure} from "../../support/llm/classifyPrefixStructure";
import {readSampleFiles} from "../../support/fileSampler";
import {generateRules} from "../../support/llm/generateRules";
import {FileInfo} from "../../data/types";

/**
 * Main workflow: Analyze project and generate rules
 */
export async function analyzeProject(options: AnalyzeOptions): Promise<void> {
  const { projectPath, outputDir } = options;

  console.log('━'.repeat(60));
  console.log('RepoRules: Analyzing Project');
  console.log('━'.repeat(60));
  console.log();

  // Validate environment
  if (!existsSync(projectPath)) {
    throw new Error(`Project path not found: ${projectPath}`);
  }

  // Validate LLM configuration and API key
  validateLLMConfig();

  // ========================================
  // Step 0: Detect and select project
  // ========================================
  const actualProjectPath = await detectAndSelectProject(projectPath);

  // Generate full tree for selected project
  console.log('📊 Analyzing project structure...');
  console.log(`   Path: ${actualProjectPath}`);
  const tree = new ProjectTree(actualProjectPath);
  const treeString = tree.toTreeString();
  const stats = tree.getStats();
  console.log(`   Found ${stats.totalFiles} files, ${stats.totalDirs} directories`);
  console.log();

  // ========================================
  // Step 1: Preliminary Analysis
  // ========================================
  const { prelimResult, configFiles } = await runPreliminaryAnalysis(treeString, projectPath);

  // ========================================
  // Step 2: Detailed Analysis (Prefix Segmentation)
  // ========================================
  const prefixes = await runDetailedAnalysis(treeString, tree, configFiles, prelimResult);

  // ========================================
  // Step 2.5: Select prefixes to analyze
  // ========================================
  const selectedPrefixes = await selectSegmentsToAnalyze(prefixes, tree);

  // ========================================
  // Step 3: Generate and save rules (parallel processing)
  // ========================================

  // Create rules directory before generating
  const rulesDir = join(actualProjectPath, outputDir, 'rules');
  if (!existsSync(rulesDir)) {
    mkdirSync(rulesDir, { recursive: true });
  }

  const ruleFiles: RuleFile[] = [];
  const segmentReports: SegmentReport[] = [];


  // Process in batches for parallel execution
  const BATCH_SIZE = ANALYSIS_CONFIG.BATCH_SIZE;
  const totalPrefixes = selectedPrefixes.length;
  const totalBatches = Math.ceil(totalPrefixes / BATCH_SIZE);

  for (let batchStart = 0; batchStart < totalPrefixes; batchStart += BATCH_SIZE) {
    const batch = selectedPrefixes.slice(batchStart, batchStart + BATCH_SIZE);
    const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;

    // Track task states for real-time rendering
    interface TaskState {
      index: number;
      prefix: string;
      status: 'processing' | 'done';
      result: BatchResult | null;
    }

    const taskStates: TaskState[] = batch.map((prefix, i) => ({
      index: batchStart + i + 1,
      prefix,
      status: 'processing',
      result: null
    }));

    // Render batch status
    let isFirstRender = true;
    function renderBatch() {
      if (!isFirstRender) {
        // Move cursor up and clear from cursor to end of screen
        const lines = taskStates.length + 2; // header + blank + tasks
        process.stdout.write(`\x1B[${lines}A`); // Move up N lines
        process.stdout.write('\x1B[0J'); // Clear from cursor to end of screen
      }
      isFirstRender = false;

      // Header
      console.log(`🔄 Batch ${batchNum}/${totalBatches}: Processing ${batch.length} segments in parallel...`);
      console.log();

      // Each task status
      for (const task of taskStates) {
        const displayPrefix = task.prefix === '' ? '(global)' : task.prefix;
        if (task.status === 'processing') {
          console.log(`   [${task.index}/${totalPrefixes}] ${displayPrefix} → Processing...`);
        } else if (task.result) {
          if (task.result.status === 'success') {
            console.log(`   [${task.index}/${totalPrefixes}] ${displayPrefix} → ✅ ${task.result.type} (${task.result.lines} lines)`);
          } else if (task.result.status === 'skipped') {
            console.log(`   [${task.index}/${totalPrefixes}] ${displayPrefix} → ⏭️  Skipped (${task.result.reason})`);
          } else {
            console.log(`   [${task.index}/${totalPrefixes}] ${displayPrefix} → ❌ Failed`);
          }
        }
      }
    }

    // Initial render
    renderBatch();

    // Process batch in parallel, re-render on each completion
    const batchResults: BatchResult[] = await Promise.all(
      batch.map(async (prefix, i) => {
        const result = await processSegmentPrefix(
          prefix,
          tree,
          actualProjectPath,
          prelimResult,
          rulesDir,
          options.experimental ?? false,
          options.includeSmall ?? false
        );

        // Update state
        taskStates[i].status = 'done';
        taskStates[i].result = result;

        // Re-render
        renderBatch();

        return result;
      })
    );

    // Collect results (no console output, just data collection)
    for (let i = 0; i < batchResults.length; i++) {
      const result = batchResults[i];

      // Add to segment reports
      segmentReports.push({
        prefix: result.prefix,
        status: result.status,
        reason: result.reason,
        type: result.type,
        lines: result.lines,
        filename: result.filename,
      });

      // Add to rule files if success
      if (result.status === 'success' && result.filename && result.content) {
        ruleFiles.push({ prefix: result.prefix, filename: result.filename, content: result.content });
      }
    }

    console.log();
  }

  // ========================================
  // Step 4: Generate skills from rules (in-memory)
  // ========================================
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

  // ========================================
  // Step 5: Save results
  // ========================================
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

  // ========================================
  // Summary
  // ========================================
  printAnalysisSummary(actualProjectPath, stats, prefixes, ruleFiles, skills, outputDir);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Step 0: Detect projects and let user select one
 *
 * @returns actualProjectPath - Selected project path
 */
async function detectAndSelectProject(
  projectPath: string
): Promise<string> {
  console.log('📊 Step 0: Detecting projects...');

  // Generate initial tree (depth 4 for project detection)
  const initialTree = new ProjectTree(projectPath, { maxDepth: ANALYSIS_CONFIG.INITIAL_TREE_DEPTH });
  const initialTreeString = initialTree.toTreeString(ANALYSIS_CONFIG.INITIAL_TREE_DEPTH);

  // Detect projects
  const detection = await detectProjects(initialTreeString);

  let actualProjectPath = projectPath;

  if (!detection.isSingleProject && detection.projects.length > 1) {
    // Multiple projects detected - show selection UI
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

    // Prompt user to select
    const choices = detection.projects.map((proj, idx) => ({
      value: proj.path,
      label: `${proj.name} (${proj.path})`,
      hint: proj.description
    }));

    // Add "Analyze all" option
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
 * Step 1: Run preliminary analysis and read config files
 */
async function runPreliminaryAnalysis(
  treeString: string,
  projectPath: string
): Promise<{
  prelimResult: any;
  configFiles: Map<string, string>;
}> {
  console.log('🤖 Step 1: Running preliminary analysis...');

  const prelimResult = await preliminaryAnalysis(treeString);
  console.log(`   Language: ${prelimResult.language}`);
  console.log(`   Architecture: ${prelimResult.architecturePattern}`);
  console.log(`   Complexity: ${prelimResult.complexity}`);
  console.log();

  // Read config files
  const configFiles = await readConfigFiles(prelimResult.filesToRead, projectPath);

  return { prelimResult, configFiles };
}

/**
 * Step 2: Run detailed analysis (prefix segmentation)
 */
async function runDetailedAnalysis(
  treeString: string,
  tree: ProjectTree,
  configFiles: Map<string, string>,
  prelimResult: any
): Promise<string[]> {
  console.log('🔍 Step 2: Segmenting project...');

  const detailedResult = await detailedAnalysis(
    treeString,
    tree,
    configFiles,
    prelimResult
  );

  const prefixes = detailedResult.prefixes;
  console.log(`   Found ${prefixes.length} segment(s)`);
  console.log();

  return prefixes;
}

/**
 * Step 2.5: Let user select segments to analyze
 */
async function selectSegmentsToAnalyze(
  prefixes: string[],
  tree: ProjectTree
): Promise<string[]> {
  let selectedPrefixes = prefixes;

  // Filter out empty prefix (global) and show selection UI if there are multiple prefixes
  const nonGlobalPrefixes = prefixes.filter(p => p !== '');

  if (nonGlobalPrefixes.length > 1) {
    console.log('📋 Select segments to analyze (for cost optimization):');
    console.log();

    const prefixChoices = nonGlobalPrefixes.map(prefix => {
      const prefixFiles = tree.pickByPrefix(prefix);
      const fileCount = prefixFiles.filter(f => f.type === 'file').length;
      return {
        value: prefix,
        label: prefix,
        hint: `${fileCount} files`
      };
    });

    // Add "All segments" option
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

    // Handle selection
    if (Array.isArray(selection) && selection.length > 0) {
      if (selection.includes('__ALL__')) {
        selectedPrefixes = prefixes;
      } else {
        // Keep global prefix + selected prefixes
        selectedPrefixes = ['', ...selection as string[]];
      }
      console.log();
      console.log(`   Selected ${selectedPrefixes.filter(p => p !== '').length} segment(s)`);
      console.log();
    } else {
      // No selection - analyze all
      selectedPrefixes = prefixes;
    }
  }

  return selectedPrefixes;
}

/**
 * Step 5: Save all analysis results to files
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

  // Save skills to skills/ directory
  if (skills.length > 0) {
    const skillsDir = join(actualProjectPath, outputDir, 'skills');
    if (!existsSync(skillsDir)) {
      mkdirSync(skillsDir, { recursive: true });
    }
    for (const skill of skills) {
      const skillPath = join(skillsDir, `${skill.title}.md`);
      writeFileSync(skillPath, skill.content);
      console.log(`   Saved: ${outputDir}/skills/${skill.title}.md`);
    }
  }

  // Generate and save USAGE.md
  const hasGlobalRules = ruleFiles.some(r => r.filename === 'global.md');
  const usageContent = buildUsageGuide(ruleFiles, hasGlobalRules, skills);
  const usagePath = join(actualProjectPath, outputDir, 'USAGE.md');
  writeFileSync(usagePath, usageContent);
  console.log(`   Saved: ${outputDir}/USAGE.md`);

  // Generate and save report.md (at outputDir root, not inside rules/)
  const reportContent = buildReportGuide({
    projectPath: actualProjectPath,
    totalFiles: stats.totalFiles,
    totalSegments: prefixes.length,
    analyzedSegments: selectedPrefixes.filter(p => p !== '').length,
    segmentReports: segmentReports,
    timestamp: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
  });
  const reportPath = join(actualProjectPath, outputDir, 'report.md');
  writeFileSync(reportPath, reportContent);
  console.log(`   Saved: ${outputDir}/report.md`);

  console.log();
}

/**
 * Process small flat segments (< 15 files) when --include-small option is enabled
 *
 * 3-stage pipeline:
 * 1. Read files (all if < 2000 lines, or LLM-selected main files if >= 2000 lines)
 * 2. Check if segment has extractable rules
 * 3. Generate rules if rules exist
 */
async function processSmallSegment(
  prefix: string,
  prefixFiles: FileInfo[],
  actualProjectPath: string,
  prelimResult: any,
  rulesDir: string
): Promise<BatchResult> {
  const sourceFiles = prefixFiles.filter(f => f.type === 'file');

  // Step 1: Determine file reading strategy (2000 line threshold)
  const totalLines = sourceFiles.reduce((sum, f) => sum + (f.lines || 0), 0);

  let sampleFiles;
  if (totalLines < 2000) {
    // Read all files directly
    sampleFiles = await readSampleFiles(sourceFiles, actualProjectPath, Infinity);
  } else {
    // LLM 1: Select main files
    const mainFiles = await selectMainFilesForSmallSegment(
      prefix,
      prefixFiles,
      ANALYSIS_CONFIG.DEFAULT_MODEL,
      false
    );
    sampleFiles = await readSampleFiles(mainFiles, actualProjectPath, 1000);
  }

  // Step 2: LLM 2 - Classify small segment type
  const segmentType = await classifySmallSegmentType(
    prefix,
    prefixFiles,
    ANALYSIS_CONFIG.DEFAULT_MODEL,
    false
  );

  // Step 3: LLM 3 - Generate rules for small segment
  const ruleContent = await generateRulesForSmallSegment(
    prefix,
    prefixFiles,
    sampleFiles,
    segmentType,
    ANALYSIS_CONFIG.DEFAULT_MODEL,
    false
  );

  // lined with no constraints → skip
  if (ruleContent.trim() === '') {
    return { prefix, status: 'skipped', reason: 'small (no constraints)' };
  }

  // Save rule file
  const filename = prefix.replace(/\//g, '-').replace(/-$/, '') + '.md';
  const rulePath = join(rulesDir, filename);
  writeFileSync(rulePath, ruleContent);

  return {
    prefix,
    filename,
    status: 'success',
    type: 'small-segment',
    lines: ruleContent.split('\n').length,
    chars: ruleContent.length,
    content: ruleContent,
  };
}

/**
 * Process a single segment prefix (classify, select samples, generate rules)
 */
async function processSegmentPrefix(
  prefix: string,
  tree: ProjectTree,
  actualProjectPath: string,
  prelimResult: any,
  rulesDir: string,
  experimental: boolean,
  includeSmall: boolean
): Promise<BatchResult> {
  // Get files for this prefix
  const prefixFiles = tree.pickByPrefix(prefix);
  const fileCount = prefixFiles.filter(f => f.type === 'file').length;

  // Skip if empty or global
  if (prefix === '' || fileCount === 0) {
    return { prefix, status: 'skipped', reason: 'global' };
  }

  // Step 3-1: Classify structure (structured vs flat)
  const structureClassification = await classifyStructured(
    prefix,
    prefixFiles,
    ANALYSIS_CONFIG.DEFAULT_MODEL,
    false
  );

  if (!structureClassification.structured) {
    // If flat AND --include-small enabled AND file count < 15
    if (includeSmall && fileCount < 15) {
      return await processSmallSegment(
        prefix,
        prefixFiles,
        actualProjectPath,
        prelimResult,
        rulesDir
      );
    }
    return { prefix, status: 'skipped', reason: 'flat' };
  }

  // Step 3-2: Select sample files (pattern analysis integrated)
  const selectedFiles = await selectSampleFilesWithLLM(
    prefix,
    tree,
    ANALYSIS_CONFIG.SELECTION_MAX_LINES,
    ANALYSIS_CONFIG.DEFAULT_MODEL,
    false
  );

  // If no patterns found (empty selection), treat as flat
  if (selectedFiles.length === 0) {
    return { prefix, status: 'skipped', reason: 'no patterns' };
  }

  // Step 3-3: Classify prefix structure (template-based vs decomposed)
  const prefixStructureClassification = await classifyPrefixStructure(
    prefix,
    selectedFiles,
    { patterns: [] }, // Pattern analysis now integrated into sample selection
    ANALYSIS_CONFIG.DEFAULT_MODEL,
    false
  );

  // Step 3-4: Read sample file contents
  const sampleFiles = await readSampleFiles(selectedFiles, actualProjectPath, ANALYSIS_CONFIG.SAMPLE_MAX_LINES);

  // Step 3-5: Generate rules
  const result = await generateRules(
    prefix,
    tree,
    sampleFiles,
    { patterns: [] }, // Pattern analysis now integrated into sample selection
    prelimResult,
    {
      structured: true,
      type: prefixStructureClassification.type
    },
    ANALYSIS_CONFIG.DEFAULT_MODEL,
    false,
    experimental
  );

  if (!result) {
    return { prefix, status: 'failed' };
  }

  const ruleContent = result.content;
  const lineCount = ruleContent.split('\n').length;

  // Save rule file immediately
  const filename = prefix.replace(/\//g, '-').replace(/-$/, '') + '.md';
  const rulePath = join(rulesDir, filename);
  writeFileSync(rulePath, ruleContent);

  return {
    prefix,
    filename,
    status: 'success',
    type: prefixStructureClassification.type,
    lines: lineCount,
    chars: ruleContent.length,
    content: ruleContent,
  };
}

/**
 * Read configuration files from disk
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
      } catch (error) {
        // Skip files that can't be read
      }
    }
  }

  return configFiles;
}

/**
 * Print final analysis summary
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
