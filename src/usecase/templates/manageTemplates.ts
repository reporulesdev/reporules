import * as p from '@clack/prompts';
import * as fs from 'fs';
import * as path from 'path';
import { resolvePackagePath } from '../../support/packagePath';

const TEMPLATES_DIR = resolvePackagePath('templates');

// ──────────────────────────────────────────────
// Template Registry (mock data - files TBD)
// ──────────────────────────────────────────────

interface TemplateEntry {
  id: string;
  name: string;
  description: string;
  language: string;
  framework: string;
}

const TEMPLATES: TemplateEntry[] = [
  // Go
  {
    id: 'go-clean-architecture',
    name: 'Clean Architecture',
    description: 'Domain / Usecase / Repository / API layered structure with MongoDB',
    language: 'Go',
    framework: 'Gin + MongoDB',
  },
  {
    id: 'go-rest-api',
    name: 'REST API',
    description: 'Standard Go REST API with internal package structure and request ID logging',
    language: 'Go',
    framework: 'Gin + MongoDB',
  },

  // Java
  {
    id: 'java-hexagonal',
    name: 'Hexagonal Architecture',
    description: 'Ports & Adapters pattern with JAX-RS, JPA and ArchUnit enforcement',
    language: 'Java',
    framework: 'Spring Boot + JAX-RS',
  },
  {
    id: 'java-layered',
    name: 'Layered Architecture',
    description: 'Classic Controller / Service / Repository layered structure',
    language: 'Java',
    framework: 'Spring Boot',
  },
  {
    id: 'java-petclinic',
    name: 'Pet Clinic (MVC)',
    description: 'Spring MVC + JPA with Bean Validation and form handling patterns',
    language: 'Java',
    framework: 'Spring MVC + JPA',
  },

  // Kotlin
  {
    id: 'kotlin-hexagonal',
    name: 'Hexagonal Architecture',
    description: 'Ports & Adapters with coroutines, R2DBC, and Valiktor input validation',
    language: 'Kotlin',
    framework: 'Spring Boot + R2DBC',
  },
  {
    id: 'kotlin-petclinic',
    name: 'Pet Clinic (MVC)',
    description: 'Spring MVC with Kotlin idioms, data classes and extension functions',
    language: 'Kotlin',
    framework: 'Spring MVC + JPA',
  },

  // Node
  {
    id: 'node-nestjs',
    name: 'NestJS (Clean)',
    description: 'NestJS module-per-domain with TypeORM, DTOs and RO response pattern',
    language: 'Node',
    framework: 'NestJS + TypeORM',
  },
  {
    id: 'node-taze',
    name: 'CLI Tool (taze)',
    description: 'Node.js CLI tool structure with commands, IO and addon layers',
    language: 'Node',
    framework: 'Node CLI',
  },

  // Python
  {
    id: 'python-fastapi',
    name: 'FastAPI (Full-stack)',
    description: 'FastAPI + SQLModel with dependency injection, CRUD pattern and Alembic',
    language: 'Python',
    framework: 'FastAPI + SQLModel',
  },
  {
    id: 'python-django',
    name: 'Django REST Framework',
    description: 'DRF with ViewSets, Serializers, custom Renderers and domain method encapsulation',
    language: 'Python',
    framework: 'Django + DRF',
  },
];

const LANGUAGES = ['Go', 'Java', 'Kotlin', 'Node', 'Python'] as const;
type Language = typeof LANGUAGES[number];

// ──────────────────────────────────────────────
// Interactive UI
// ──────────────────────────────────────────────

export async function runTemplateCommand(outputDir: string): Promise<void> {
  p.intro('reporules template');

  // Step 1 & 2: Language → Template (with back navigation)
  let language: Language | undefined;
  let selected: TemplateEntry | undefined;

  while (!selected) {
    // Step 1: Select language
    if (!language) {
      const lang = await p.select<Language>({
        message: 'Select language',
        options: LANGUAGES.map(l => ({
          value: l,
          label: l,
        })),
      });

      if (p.isCancel(lang)) {
        p.cancel('Cancelled');
        process.exit(0);
      }

      language = lang;
    }

    // Step 2: Select template within the language
    const filtered = TEMPLATES.filter(t => t.language === language);

    const templateId = await p.select<string>({
      message: `Select template  (${language})`,
      options: [
        { value: '__back__', label: '← Back' },
        ...filtered.map(t => ({
          value: t.id,
          label: `${t.name}\n   · ${t.description}`,
        })),
      ],
    });

    if (p.isCancel(templateId)) {
      p.cancel('Cancelled');
      process.exit(0);
    }

    if (templateId === '__back__') {
      language = undefined;
      continue;
    }

    selected = TEMPLATES.find(t => t.id === templateId)!;
  }

  // Step 3: Confirm
  const confirmed = await p.confirm({
    message: `Install "${selected.name}" to ${outputDir}/${selected.id}/ ?`,
  });

  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel('Cancelled');
    process.exit(0);
  }

  // Step 4: Install
  const spinner = p.spinner();
  spinner.start('Installing...');

  const copiedFiles = copyTemplateFiles(selected.id, outputDir);

  spinner.stop(`${copiedFiles.length} files copied`);

  p.outro(`Installed "${selected.name}" → ${outputDir}/${selected.id}/\n  Framework: ${selected.framework}`);
}

// ──────────────────────────────────────────────
// File copy logic
// ──────────────────────────────────────────────

function copyTemplateFiles(templateId: string, outputDir: string): string[] {
  const srcDir = path.join(TEMPLATES_DIR, templateId);
  const destDir = path.join(process.cwd(), outputDir, templateId);

  if (!fs.existsSync(srcDir)) {
    throw new Error(`Template files not found for "${templateId}" (looked in: ${srcDir})`);
  }

  const copied: string[] = [];
  copyDirRecursive(srcDir, destDir, copied);
  return copied;
}

function copyDirRecursive(src: string, dest: string, collected: string[]): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, collected);
    } else if (entry.name.endsWith('.md')) {
      fs.copyFileSync(srcPath, destPath);
      collected.push(destPath);
    }
  }
}

// ──────────────────────────────────────────────
// Legacy API (kept for backward compat)
// ──────────────────────────────────────────────

export interface Template {
  name: string;
  description: string;
  framework: string;
  files: string[];
}

export async function listTemplates(): Promise<Template[]> {
  return TEMPLATES.map(t => ({
    name: t.id,
    description: t.description,
    framework: t.framework,
    files: [],
  }));
}

export async function installTemplate(templateName: string, outputDir: string): Promise<void> {
  const found = TEMPLATES.find(t => t.id === templateName);
  if (!found) {
    throw new Error(`Template "${templateName}" not found. Run "reporules template" to see available templates.`);
  }
  // TODO: actual file copy
  console.log(`📦 Installing template: ${found.name}`);
  console.log(`📁 Output directory: ${outputDir}/rules/`);
  throw new Error('Not implemented yet - use "reporules template" for interactive install');
}
