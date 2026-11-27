import type { z, ZodObject, ZodRawShape } from 'zod';
import type { ToolDefinition } from '../model/model.types';
import { formatZodIssues } from '../schema/format-zod-issues';
import { zodToJsonSchema } from '../schema/zod-json-schema';
import { RowList, fitRowList } from './row-list';
import { wrapUntrusted } from './untrusted-content';

export const DEFAULT_TOOL_OUTPUT_CAP_CHARS = 8_000;

export interface ToolContext {
  runId: string;
  markEmpty?: () => void;
}

export interface ToolSpec<TShape extends ZodRawShape> {
  name: string;
  description: string;
  inputSchema: ZodObject<TShape>;
  readOnly: boolean;
  startsPaidWork?: boolean;
  maxOutputChars?: number;
  untrustedLabel?: string;
  isEmpty?(output: unknown): boolean;
  handler(input: z.infer<ZodObject<TShape>>, context: ToolContext): Promise<unknown>;
}

export interface Tool {
  readonly name: string;
  readonly readOnly: boolean;
  readonly startsPaidWork: boolean;
  readonly maxOutputChars: number;
  readonly definition: ToolDefinition;
  run(rawInput: unknown, context: ToolContext): Promise<string>;
}

export class ToolInputError extends Error {
  constructor(toolName: string, issues: string) {
    super(`Invalid input for tool "${toolName}": ${issues}`);
    this.name = 'ToolInputError';
  }
}

function stringifyOutput(output: unknown, maxChars: number): string {
  if (output instanceof RowList) return fitRowList(output, maxChars);
  return typeof output === 'string' ? output : (JSON.stringify(output) ?? '');
}

function isEmptyByDefault(output: unknown): boolean {
  return output instanceof RowList
    ? output.rows.length === 0
    : output === undefined || output === null;
}

function untrustedOverhead(label: string): number {
  return wrapUntrusted(label, '').length;
}

export function defineTool<TShape extends ZodRawShape>(spec: ToolSpec<TShape>): Tool {
  const maxOutputChars = spec.maxOutputChars ?? DEFAULT_TOOL_OUTPUT_CAP_CHARS;
  const { untrustedLabel } = spec;
  const contentBudget =
    untrustedLabel === undefined
      ? maxOutputChars
      : maxOutputChars - untrustedOverhead(untrustedLabel);
  return {
    name: spec.name,
    readOnly: spec.readOnly,
    startsPaidWork: spec.startsPaidWork ?? false,
    maxOutputChars,
    definition: {
      name: spec.name,
      description: spec.description,
      inputSchema: zodToJsonSchema(spec.inputSchema),
    },
    async run(rawInput, context) {
      const parsed = spec.inputSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new ToolInputError(spec.name, formatZodIssues(parsed.error).join('; '));
      }
      const output = await spec.handler(parsed.data, context);
      if ((spec.isEmpty ?? isEmptyByDefault)(output)) context.markEmpty?.();
      const content = stringifyOutput(output, contentBudget);
      return untrustedLabel === undefined ? content : wrapUntrusted(untrustedLabel, content);
    },
  };
}
