import { z } from 'zod';

import { defineTool, type Tool } from '@ratingo/ai-core';
import { createOpsTools } from '@ratingo/ai-ops-tools';

import { SeriesMetric } from '../../../digest/public';
import { ASK_DUME_QUESTION_MAX_CHARS } from '../../domain/constants/dume.constants';
import {
  ASK_HAPPY_OUTPUT_CAP,
  RELEASE_BASE_BRANCH,
  RELEASE_HEAD_BRANCH,
} from '../../domain/constants/happy.constants';
import {
  ASK_DUME_OUTPUT_CAP,
  CHANGES_OUTPUT_CAP,
  InvestigationTool,
  PRODUCT_OUTPUT_CAP,
  SNAPSHOT_OUTPUT_CAP,
} from '../../domain/constants/investigation.constants';

import type { AskDumeInput, InvestigationExecutors } from './investigation-executors';

const SERIES_METRICS = Object.values(SeriesMetric) as [SeriesMetric, ...SeriesMetric[]];

const MAX_PULL_NUMBER = 999_999_999;

export const productStatsInput = z.object({
  metric: z.enum(SERIES_METRICS).describe('new_users, actions or active_users'),
  window: z
    .string()
    .optional()
    .describe('How far back to look, such as 3d or 7d (at most 7d). Default 7d'),
});

export const recentChangesInput = z.object({
  window: z
    .string()
    .optional()
    .describe('How far back to look, such as 24h or 7d (at most 7d). Default 24h'),
  into: z
    .enum([RELEASE_HEAD_BRANCH, RELEASE_BASE_BRANCH])
    .optional()
    .describe('Only pull requests merged into this branch'),
});

export const askHappyInput = z.object({
  pull_number: z
    .number()
    .int()
    .min(1)
    .max(MAX_PULL_NUMBER)
    .describe('Pull request number in the Ratingo repository'),
});

export const askDumeInput = z.object({
  question: z
    .string()
    .min(1)
    .max(ASK_DUME_QUESTION_MAX_CHARS)
    .describe(
      'The question to investigate, written so it stands on its own: include the names, services and times from the conversation',
    ),
});

const ASK_DUME_DESCRIPTION =
  'Hands one question to DUM-E, the code investigator, to run in the background. DUM-E reads the code of the main branch together with production logs, failed jobs and metrics, and answers why something behaves as it does; every claim is checked against the code lines and data rows it actually read. It takes several minutes and costs real money, and its answer arrives later as a separate message sent by the system, not by you. Use it only for a "why" or "how does this work" question that cannot be settled from the numbers, logs, job failures, changes and pull request results your other tools return, because the code has to be read as well. Do not use it for the current state, counts, lists, schedules, recent errors, what Happy said, or anything another tool answers directly. When the question fits, start it yourself and do not ask the owner whether to start it; call it even if you suspect DUM-E may be unavailable, because the tool reports that itself. Call it at most once per message. It returns at once with a status and an ownerNotice: tell the owner that notice in full, in a line or two, and do not guess the cause yourself.';

const noInput = z.object({});

export const buildInvestigationTools = (
  executors: InvestigationExecutors,
  askDume: (input: AskDumeInput) => Promise<unknown>,
): Tool[] => {
  const ops = createOpsTools(executors);
  return [
    ops.metricsQuery,
    defineTool({
      name: InvestigationTool.PRODUCT_STATS,
      description:
        'Daily product numbers by Kyiv day: new_users (signups), actions (watch states, ratings, reviews, saves, subscriptions, imports), active_users.',
      inputSchema: productStatsInput,
      readOnly: true,
      maxOutputChars: PRODUCT_OUTPUT_CAP,
      handler: (input) => executors.productStats(input),
    }),
    defineTool({
      name: InvestigationTool.DIGEST_SNAPSHOT,
      description:
        'Today’s overall picture: the level (ok, note, action) of every block, the advice items and their numbers with last week for comparison, and which sources answered.',
      inputSchema: noInput,
      readOnly: true,
      maxOutputChars: SNAPSHOT_OUTPUT_CAP,
      handler: () => executors.digestSnapshot(),
    }),
    defineTool({
      name: InvestigationTool.RECENT_CHANGES,
      description:
        'Pull requests merged into main and development and recent deploys, with merge and deploy times in Kyiv time. Titles and numbers only.',
      inputSchema: recentChangesInput,
      readOnly: true,
      maxOutputChars: CHANGES_OUTPUT_CAP,
      handler: (input) => executors.recentChanges(input),
    }),
    defineTool({
      name: InvestigationTool.ASK_HAPPY,
      description:
        'What Happy, the pull request reviewer, said about one pull request: the verdict, finding counts by severity, questions to the author and what was not reviewed. Includes whether it was a full review or only the new commits since the last one, with how many findings were fixed, still open and new. Only reads a finished result and never starts a review.',
      inputSchema: askHappyInput,
      readOnly: true,
      maxOutputChars: ASK_HAPPY_OUTPUT_CAP,
      handler: (input) => executors.askHappy(input),
    }),
    ops.jobFailures,
    ops.logsSearch,
    ops.dbSchema,
    ops.dbQuery,
    defineTool({
      name: InvestigationTool.ASK_DUME,
      description: ASK_DUME_DESCRIPTION,
      inputSchema: askDumeInput,
      readOnly: true,
      startsPaidWork: true,
      maxOutputChars: ASK_DUME_OUTPUT_CAP,
      handler: (input) => askDume(input),
    }),
  ];
};
