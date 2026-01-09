import { readFileSync } from 'node:fs';
import chalk from 'chalk';
import type { PolicyConfig } from './api.js';

export function loadPolicyFile(path: string): PolicyConfig {
  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Policy file not found: ${path}`);
    }
    throw new Error(`Failed to parse policy file: ${(err as Error).message}`);
  }
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

export function printSummary(summary: {
  totalEvaluated: number;
  eligible: number;
  ineligible: number;
  newlyEligible: number;
  newlyIneligible: number;
  reasonBreakdown: Array<{ reason: string; count: number }>;
}) {
  console.log();
  console.log(chalk.bold('Summary'));
  console.log(`  Total evaluated: ${formatNumber(summary.totalEvaluated)}`);
  console.log(`  ${chalk.green('Eligible')}: ${formatNumber(summary.eligible)} (${formatPercent(summary.eligible, summary.totalEvaluated)})`);
  console.log(`  ${chalk.red('Ineligible')}: ${formatNumber(summary.ineligible)} (${formatPercent(summary.ineligible, summary.totalEvaluated)})`);
  console.log();
  console.log(chalk.bold('Changes'));
  console.log(`  ${chalk.green('+')} Newly eligible: ${formatNumber(summary.newlyEligible)}`);
  console.log(`  ${chalk.red('-')} Newly ineligible: ${formatNumber(summary.newlyIneligible)}`);
  
  if (summary.reasonBreakdown.length > 0) {
    console.log();
    console.log(chalk.bold('Top reasons'));
    summary.reasonBreakdown.slice(0, 10).forEach(({ reason, count }) => {
      console.log(`  ${reason}: ${formatNumber(count)}`);
    });
  }
}

export function printRunStatus(run: {
  id: string;
  status: string;
  targetPolicyVersion: number;
  progress?: { processed: number; total: number; eligible: number; ineligible: number };
}) {
  const statusColor = run.status === 'promoted' ? chalk.green :
                      run.status === 'prepared' ? chalk.yellow :
                      run.status === 'running' ? chalk.blue : chalk.gray;
  
  console.log();
  console.log(`Run: ${chalk.dim(run.id)}`);
  console.log(`Status: ${statusColor(run.status)}`);
  console.log(`Policy version: ${run.targetPolicyVersion}`);
  
  if (run.progress) {
    const pct = run.progress.total > 0 
      ? ((run.progress.processed / run.progress.total) * 100).toFixed(0)
      : 0;
    console.log(`Progress: ${run.progress.processed}/${run.progress.total} (${pct}%)`);
    console.log(`  ${chalk.green('Eligible')}: ${run.progress.eligible}`);
    console.log(`  ${chalk.red('Ineligible')}: ${run.progress.ineligible}`);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
