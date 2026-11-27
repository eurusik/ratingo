import { z } from 'zod';

import { defineTool, type Tool } from '@ratingo/ai-core';
import { createOpsTools } from '@ratingo/ai-ops-tools';

import { SeriesMetric } from '../../../digest/public';
import {
  ASK_HAPPY_OUTPUT_CAP,
  RELEASE_BASE_BRANCH,
  RELEASE_HEAD_BRANCH,
} from '../../domain/constants/happy.constants';
import {
  CHANGES_OUTPUT_CAP,
  InvestigationTool,
  PRODUCT_OUTPUT_CAP,
  SNAPSHOT_OUTPUT_CAP,
} from '../../domain/constants/investigation.constants';

import type { InvestigationExecutors } from './investigation-executors';

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

const noInput = z.object({});

export const buildInvestigationTools = (executors: InvestigationExecutors): Tool[] => {
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
  ];
};
