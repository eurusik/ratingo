import { readdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { InvalidModelRefError, parseModelRef } from '../model/model-ref';
import { describeError } from '../shared/describe-error';
import { formatZodIssues } from '../schema/format-zod-issues';
import { agentManifestSchema } from './agent-manifest.schema';
import type { AgentManifest } from './agent-manifest.schema';
import type { TaskDefinition } from './task.definition';
import { taskFrontmatterSchema } from './task.schema';

const MANIFEST_FILE = 'agent.yaml';
const TASKS_DIR = 'tasks';
const PROMPTS_DIR = 'prompts';
const SKILLS_DIR = 'skills';
const SKILL_FILE = 'SKILL.md';
const MARKDOWN_EXTENSION = '.md';
const FRONTMATTER_DELIMITER = '---';
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const NOT_FOUND_CODE = 'ENOENT';

export interface AgentFolder {
  manifest: AgentManifest;
  tasks: TaskDefinition[];
  prompts: Record<string, string>;
}

export interface LoadAgentFolderOptions {
  knownModelAliases?: readonly string[];
}

export class AgentFolderError extends Error {
  constructor(
    readonly folder: string,
    readonly issues: readonly string[],
  ) {
    super(`Invalid agent folder ${folder}:\n${issues.map((issue) => `- ${issue}`).join('\n')}`);
    this.name = 'AgentFolderError';
  }
}

interface Loaded<T> {
  value?: T;
  issues: string[];
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as NodeJS.ErrnoException).code === NOT_FOUND_CODE
  );
}

async function readTextIfExists(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (isNotFound(error)) {
      return undefined;
    }
    throw error;
  }
}

async function listMarkdownFiles(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory);
    return entries.filter((entry) => entry.endsWith(MARKDOWN_EXTENSION)).sort();
  } catch (error) {
    if (isNotFound(error)) {
      return [];
    }
    throw error;
  }
}

function stripMarkdownExtension(file: string): string {
  return file.slice(0, -MARKDOWN_EXTENSION.length);
}

function taskLabel(file: string): string {
  return `${TASKS_DIR}/${file}`;
}

function parseYamlText(source: string, label: string): Loaded<unknown> {
  try {
    return { value: parseYaml(source) as unknown, issues: [] };
  } catch (error) {
    return { issues: [`${label}: invalid YAML (${describeError(error)})`] };
  }
}

async function loadManifest(folder: string): Promise<Loaded<AgentManifest>> {
  const source = await readTextIfExists(path.join(folder, MANIFEST_FILE));
  if (source === undefined) {
    return { issues: [`${MANIFEST_FILE}: file is missing`] };
  }
  const yaml = parseYamlText(source, MANIFEST_FILE);
  if (yaml.issues.length > 0) {
    return { issues: yaml.issues };
  }
  const parsed = agentManifestSchema.safeParse(yaml.value);
  return parsed.success
    ? { value: parsed.data, issues: [] }
    : {
        issues: formatZodIssues(parsed.error).map((issue) => `${MANIFEST_FILE}.${issue}`),
      };
}

function parseTaskFile(file: string, source: string): Loaded<TaskDefinition> {
  const label = taskLabel(file);
  const match = FRONTMATTER_PATTERN.exec(source);
  if (match === null && source.startsWith(FRONTMATTER_DELIMITER)) {
    return { issues: [`${label}: frontmatter is not closed with ${FRONTMATTER_DELIMITER}`] };
  }
  const yaml = parseYamlText(match?.[1] ?? '', label);
  if (yaml.issues.length > 0) {
    return { issues: yaml.issues };
  }
  const parsed = taskFrontmatterSchema.safeParse(yaml.value ?? {});
  if (!parsed.success) {
    return { issues: formatZodIssues(parsed.error).map((issue) => `${label}.${issue}`) };
  }
  return {
    value: {
      name: stripMarkdownExtension(file),
      frontmatter: parsed.data,
      body: (match?.[2] ?? source).trim(),
    },
    issues: [],
  };
}

async function loadTasks(folder: string): Promise<Loaded<TaskDefinition[]>> {
  const tasksDir = path.join(folder, TASKS_DIR);
  const tasks: TaskDefinition[] = [];
  const issues: string[] = [];
  for (const file of await listMarkdownFiles(tasksDir)) {
    const source = await readFile(path.join(tasksDir, file), 'utf8');
    const loaded = parseTaskFile(file, source);
    issues.push(...loaded.issues);
    if (loaded.value !== undefined) {
      tasks.push(loaded.value);
    }
  }
  return { value: tasks, issues };
}

async function loadPrompts(folder: string): Promise<Record<string, string>> {
  const promptsDir = path.join(folder, PROMPTS_DIR);
  const prompts: Record<string, string> = {};
  for (const file of await listMarkdownFiles(promptsDir)) {
    const source = await readFile(path.join(promptsDir, file), 'utf8');
    prompts[stripMarkdownExtension(file)] = source.trim();
  }
  return prompts;
}

async function findMissingSkills(folder: string, manifest: AgentManifest): Promise<string[]> {
  const issues: string[] = [];
  for (const skill of manifest.skills) {
    const body = await readTextIfExists(path.join(folder, SKILLS_DIR, skill, SKILL_FILE));
    if (body === undefined) {
      issues.push(`${MANIFEST_FILE}: skill "${skill}" has no ${SKILLS_DIR}/${skill}/${SKILL_FILE}`);
    }
  }
  return issues;
}

function isKnownModel(value: string, aliases: readonly string[]): boolean {
  if (aliases.includes(value)) {
    return true;
  }
  try {
    parseModelRef(value);
    return true;
  } catch (error) {
    if (error instanceof InvalidModelRefError) {
      return false;
    }
    throw error;
  }
}

function findUnknownModelAliases(
  manifest: AgentManifest,
  tasks: readonly TaskDefinition[],
  aliases: readonly string[],
): string[] {
  const manifestIssues = Object.entries(manifest.models)
    .filter(([, value]) => !isKnownModel(value, aliases))
    .map(([key, value]) => `${MANIFEST_FILE}: models.${key} uses unknown alias "${value}"`);
  const taskIssues = tasks.flatMap((task) => {
    const model = task.frontmatter.model;
    return model === undefined || isKnownModel(model, aliases)
      ? []
      : [`${taskLabel(`${task.name}${MARKDOWN_EXTENSION}`)}: model uses unknown alias "${model}"`];
  });
  return [...manifestIssues, ...taskIssues];
}

export async function loadAgentFolder(
  folder: string,
  options: LoadAgentFolderOptions = {},
): Promise<AgentFolder> {
  const manifest = await loadManifest(folder);
  const tasks = await loadTasks(folder);
  const prompts = await loadPrompts(folder);
  const issues = [...manifest.issues, ...tasks.issues];
  if (manifest.value !== undefined) {
    issues.push(...(await findMissingSkills(folder, manifest.value)));
    if (options.knownModelAliases !== undefined) {
      issues.push(
        ...findUnknownModelAliases(manifest.value, tasks.value ?? [], options.knownModelAliases),
      );
    }
  }
  if (issues.length > 0 || manifest.value === undefined) {
    throw new AgentFolderError(folder, issues);
  }
  return { manifest: manifest.value, tasks: tasks.value ?? [], prompts };
}
