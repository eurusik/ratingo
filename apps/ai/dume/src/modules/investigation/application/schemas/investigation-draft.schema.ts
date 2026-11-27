import { z } from 'zod';

import { CitationLimits } from '../../domain/constants/investigation.constants';

const citationSchema = z.object({
  path: z.string().min(1).max(300),
  startLine: z.number().int().min(1),
  endLine: z.number().int().min(1),
});

const claimSchema = z.object({
  text: z.string().min(1).max(600),
  citations: z.array(citationSchema).max(CitationLimits.MAX_CITATIONS_PER_CLAIM),
  evidence: z
    .array(z.string().min(1).max(CitationLimits.MAX_EVIDENCE_REF_CHARS))
    .max(CitationLimits.MAX_EVIDENCE_PER_CLAIM)
    .default([]),
});

export const investigationDraftSchema = z.object({
  answer: z.string().min(1).max(1_500),
  claims: z.array(claimSchema).max(CitationLimits.MAX_CLAIMS),
  assumptions: z.array(z.string().min(1).max(400)).max(CitationLimits.MAX_ASSUMPTIONS),
  unknowns: z.array(z.string().min(1).max(400)).max(CitationLimits.MAX_UNKNOWNS),
});
