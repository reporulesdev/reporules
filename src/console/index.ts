#!/usr/bin/env node

import { Command } from 'commander';
import { showConfig } from '../usecase/showConfig';
import { listTemplates, installTemplate, runTemplateCommand } from '../usecase/templates/manageTemplates';
import { analyzeProject } from '../usecase/analyze/analyzeProject';

const program = new Command();

program
  .name('reporules')
  .description('Automatically generate Claude Code rules from your codebase')
  .version('0.1.0');

// config command
program
  .command('config')
  .description('Show current configuration and setup instructions')
  .action(() => {
    showConfig();
  });

// analyze command
program
  .command('analyze')
  .description('Analyze codebase structure and generate rules')
  .argument('[path]', 'Path to codebase', '.')
  .option('--output <path>', 'Output directory for generated rules', '.reporules')
  .option('--experimental', 'Use new GPT-5.1 style prompt (experimental)')
  .option('--include-small', 'Analyze small flat modules (1-10 files) for potential rules')
  .action(async (path: string, options: { output?: string; experimental?: boolean; includeSmall?: boolean }) => {
    try {
      await analyzeProject({
        projectPath: path,
        outputDir: options.output || '.reporules',
        experimental: options.experimental || false,
        includeSmall: options.includeSmall || false,
      });
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// template command (interactive)
program
  .command('template')
  .description('Browse and install pre-analyzed templates')
  .option('--output <path>', 'Output directory for templates', '.reporules')
  .action(async (options: { output?: string }) => {
    try {
      await runTemplateCommand(options.output || '.reporules');
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// templates command (legacy)
program
  .command('templates')
  .description('Manage pre-analyzed templates')
  .argument('<action>', 'Action: list or install')
  .argument('[name]', 'Template name (for install)')
  .option('--output <path>', 'Output directory for templates', '.reporules')
  .action(async (action: string, name: string | undefined, options: { output?: string }) => {
    try {
      if (action === 'list') {
        console.log('📋 Available Templates:\n');
        const templates = await listTemplates();
        templates.forEach((template, index) => {
          console.log(`${index + 1}. ${template.name}`);
          console.log(`   ${template.description}`);
          console.log(`   Framework: ${template.framework}`);
          console.log(`   Files: ${template.files.join(', ')}`);
          console.log();
        });
        console.log('Usage: reporules templates install <name>');
      } else if (action === 'install') {
        if (!name) {
          console.error('❌ Error: Template name required');
          console.log('Usage: reporules templates install <name>');
          console.log('Run "reporules templates list" to see available templates');
          process.exit(1);
        }
        await installTemplate(name, options.output || '.reporules');
      } else {
        console.error(`❌ Error: Unknown action "${action}"`);
        console.log('Available actions: list, install');
        process.exit(1);
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

program.parse();
