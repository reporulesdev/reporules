
import { BatchResult, RuleFile } from './types';
import { ANALYSIS_CONFIG } from './constants';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { ProjectTree } from '../../support/projectTree';
import { SegmentReport } from '../../support/reportBuilder/buildReportGuide';
import {
  pickSmallSegmentFiles,
  classifySmallSegment,
  generateSmallSegmentRules,
  generateRules
} from '../../support/llm/generateRules';
import { detectSegmentPattern } from '../../support/llm/detectSegmentPattern';
import { pickSampleFiles } from '../../support/llm/pickSampleFiles';
import { classifySegmentType } from '../../support/llm/classifySegmentType';
import { readSampleFiles } from '../../support/fileSampler';
import { FileInfo, PreliminaryAnalysisResult } from '../../data/types';

interface TaskState {
  index: number;
  prefix: string;
  status: 'processing' | 'done';
  result: BatchResult | null;
}

/**
 * Run all segment batches in parallel and collect results
 * 모든 세그먼트 배치를 병렬 실행하고 결과를 수집
 */
export async function generateAllSegmentRules(
  selectedPrefixes: string[],
  tree: ProjectTree,
  actualProjectPath: string,
  prelimResult: PreliminaryAnalysisResult,
  rulesDir: string,
  experimental: boolean,
  includeSmall: boolean
): Promise<{ ruleFiles: RuleFile[]; segmentReports: SegmentReport[] }> {
  const ruleFiles: RuleFile[] = [];
  const segmentReports: SegmentReport[] = [];

  const totalPrefixes = selectedPrefixes.length;
  const totalBatches = Math.ceil(totalPrefixes / ANALYSIS_CONFIG.BATCH_SIZE);

  for (let batchStart = 0; batchStart < totalPrefixes; batchStart += ANALYSIS_CONFIG.BATCH_SIZE) {
    const batch = selectedPrefixes.slice(batchStart, batchStart + ANALYSIS_CONFIG.BATCH_SIZE);
    const batchNum = Math.floor(batchStart / ANALYSIS_CONFIG.BATCH_SIZE) + 1;

    const batchResults = await processBatch(
      batch, batchStart, batchNum, totalBatches, totalPrefixes,
      tree, actualProjectPath, prelimResult, rulesDir, experimental, includeSmall
    );

    for (const result of batchResults) {
      segmentReports.push({
        prefix: result.prefix,
        status: result.status,
        reason: result.reason,
        type: result.type,
        lines: result.lines,
        filename: result.filename,
      });

      if (result.status === 'success' && result.filename && result.content) {
        ruleFiles.push({ prefix: result.prefix, filename: result.filename, content: result.content });
      }
    }

    console.log();
  }

  return { ruleFiles, segmentReports };
}

/**
 * Run one batch of segments in parallel with live console rendering
 * 배치 1개를 병렬 실행하고 콘솔에 실시간으로 렌더링
 */
async function processBatch(
  batch: string[],
  batchStart: number,
  batchNum: number,
  totalBatches: number,
  totalPrefixes: number,
  tree: ProjectTree,
  actualProjectPath: string,
  prelimResult: PreliminaryAnalysisResult,
  rulesDir: string,
  experimental: boolean,
  includeSmall: boolean
): Promise<BatchResult[]> {
  const taskStates: TaskState[] = batch.map((prefix, i) => ({
    index: batchStart + i + 1,
    prefix,
    status: 'processing',
    result: null,
  }));

  let isFirstRender = true;
  function renderBatch() {
    if (!isFirstRender) {
      const lines = taskStates.length + 2; // header + blank line
      process.stdout.write(`\x1B[${lines}A`); // move up N lines
      process.stdout.write('\x1B[0J');        // clear from cursor to end
    }
    isFirstRender = false;

    console.log(`🔄 Batch ${batchNum}/${totalBatches}: Processing ${batch.length} segments in parallel...`);
    console.log();

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

  renderBatch();

  return Promise.all(
    batch.map(async (prefix, i) => {
      const result = await processSegment(
        prefix, tree, actualProjectPath, prelimResult, rulesDir, experimental, includeSmall
      );

      taskStates[i].status = 'done';
      taskStates[i].result = result;
      renderBatch();

      return result;
    })
  );
}

/**
 * Classify and generate rules for a single segment.
 * 단일 세그먼트를 분류하고 rules를 생성. flat이거나 비어있으면 skip.
 */
async function processSegment(
  prefix: string,
  tree: ProjectTree,
  actualProjectPath: string,
  prelimResult: PreliminaryAnalysisResult,
  rulesDir: string,
  experimental: boolean,
  includeSmall: boolean
): Promise<BatchResult> {
  const prefixFiles = tree.pickByPrefix(prefix);
  const fileCount = prefixFiles.filter(f => f.type === 'file').length;

  if (prefix === '' || fileCount === 0) {
    return { prefix, status: 'skipped', reason: 'global' };
  }

  const patternResult = await detectSegmentPattern(
    prefix, prefixFiles, ANALYSIS_CONFIG.DEFAULT_MODEL, false
  );

  if (!patternResult.structured) {
    if (includeSmall && fileCount < 15) {
      return await processSmallSegment(prefix, prefixFiles, actualProjectPath, rulesDir);
    }
    return { prefix, status: 'skipped', reason: 'flat' };
  }

  const selectedFiles = await pickSampleFiles(
    prefix, tree, ANALYSIS_CONFIG.SELECTION_MAX_LINES, ANALYSIS_CONFIG.DEFAULT_MODEL, false
  );

  if (selectedFiles.length === 0) {
    return { prefix, status: 'skipped', reason: 'no patterns' };
  }

  const segmentType = await classifySegmentType(
    prefix, selectedFiles, { patterns: [] }, ANALYSIS_CONFIG.DEFAULT_MODEL, false
  );

  const sampleFiles = await readSampleFiles(
    selectedFiles, actualProjectPath, ANALYSIS_CONFIG.SAMPLE_MAX_LINES
  );

  const result = await generateRules(
    prefix, tree, sampleFiles, { patterns: [] }, prelimResult,
    { structured: true, type: segmentType.type },
    ANALYSIS_CONFIG.DEFAULT_MODEL, false, experimental
  );

  if (!result) {
    return { prefix, status: 'failed' };
  }

  const ruleContent = result.content;
  const filename = prefix.replace(/\//g, '-').replace(/-$/, '') + '.md';
  writeFileSync(join(rulesDir, filename), ruleContent);

  return {
    prefix,
    filename,
    status: 'success',
    type: segmentType.type,
    lines: ruleContent.split('\n').length,
    chars: ruleContent.length,
    content: ruleContent,
  };
}

/**
 * Generate rules for a small flat segment (< 15 files) via 3-stage pipeline.
 * 소형 flat 세그먼트(< 15 파일)를 3단계 파이프라인으로 처리:
 * 1. Read files — all if < 2000 total lines, else LLM-selected main files
 * 2. Classify segment type
 * 3. Generate rules (returns empty string if no meaningful constraints found)
 */
async function processSmallSegment(
  prefix: string,
  prefixFiles: FileInfo[],
  actualProjectPath: string,
  rulesDir: string
): Promise<BatchResult> {
  const sourceFiles = prefixFiles.filter(f => f.type === 'file');
  const totalLines = sourceFiles.reduce((sum, f) => sum + (f.lines || 0), 0);

  let sampleFiles;
  if (totalLines < 2000) {
    sampleFiles = await readSampleFiles(sourceFiles, actualProjectPath, Infinity);
  } else {
    const mainFiles = await pickSmallSegmentFiles(
      prefix, prefixFiles, ANALYSIS_CONFIG.DEFAULT_MODEL, false
    );
    sampleFiles = await readSampleFiles(mainFiles, actualProjectPath, 1000);
  }

  const segmentType = await classifySmallSegment(
    prefix, prefixFiles, ANALYSIS_CONFIG.DEFAULT_MODEL, false
  );

  const ruleContent = await generateSmallSegmentRules(
    prefix, prefixFiles, sampleFiles, segmentType, ANALYSIS_CONFIG.DEFAULT_MODEL, false
  );

  if (ruleContent.trim() === '') {
    return { prefix, status: 'skipped', reason: 'small (no constraints)' };
  }

  const filename = prefix.replace(/\//g, '-').replace(/-$/, '') + '.md';
  writeFileSync(join(rulesDir, filename), ruleContent);

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
