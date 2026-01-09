import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

import { createClient } from '../lib/api.js';
import { printRunStatus, sleep } from '../lib/utils.js';

export const runCommand = new Command('run')
  .description('Run management (prepare, status, promote, list)');

runCommand
  .command('prepare <policyId>')
  .description('Start policy evaluation run')
  .action(async (policyId, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals();
    const client = await createClient(globalOpts);
    
    const spinner = ora('Starting evaluation run...').start();
    
    try {
      const result = await client.preparePolicy(policyId);
      spinner.succeed('Evaluation started');
      console.log(`  Run ID: ${chalk.dim(result.data.runId)}`);
      console.log(`  Status: ${result.data.status}`);
    } catch (err) {
      spinner.fail('Failed to start evaluation');
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

runCommand
  .command('status <runId>')
  .description('Get run status')
  .option('--watch', 'Watch for updates until complete')
  .option('--interval <ms>', 'Poll interval in ms', '3000')
  .action(async (runId, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals();
    const client = await createClient(globalOpts);
    
    try {
      if (opts.watch) {
        const spinner = ora('Watching run progress...').start();
        const interval = parseInt(opts.interval, 10);
        
        while (true) {
          const result = await client.getRunStatus(runId);
          const run = result.data;
          const progress = run.progress;
          
          if (progress) {
            const pct = progress.total > 0 
              ? ((progress.processed / progress.total) * 100).toFixed(0)
              : 0;
            spinner.text = `${run.status} - ${progress.processed}/${progress.total} (${pct}%) | eligible: ${progress.eligible} | ineligible: ${progress.ineligible}`;
          }
          
          if (run.status === 'prepared' || run.status === 'promoted' || run.status === 'failed') {
            spinner.succeed(`Run ${run.status}`);
            printRunStatus(run);
            break;
          }
          
          await sleep(interval);
        }
      } else {
        const result = await client.getRunStatus(runId);
        
        if (globalOpts.json) {
          console.log(JSON.stringify(result.data, null, 2));
        } else {
          printRunStatus(result.data);
        }
      }
    } catch (err) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

runCommand
  .command('promote <runId>')
  .description('Promote a prepared run to active')
  .option('-y, --yes', 'Skip confirmation')
  .action(async (runId, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals();
    const client = await createClient(globalOpts);
    
    // Check run status first
    const statusResult = await client.getRunStatus(runId);
    if (statusResult.data.status !== 'prepared') {
      console.error(chalk.red(`Run is not prepared (status: ${statusResult.data.status})`));
      process.exit(1);
    }
    
    printRunStatus(statusResult.data);
    
    if (!opts.yes) {
      const readline = await import('node:readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise<string>(resolve => {
        rl.question('\nPromote this run? (y/N) ', resolve);
      });
      rl.close();
      
      if (answer.toLowerCase() !== 'y') {
        console.log('Cancelled');
        process.exit(0);
      }
    }
    
    const spinner = ora('Promoting run...').start();
    
    try {
      const result = await client.promoteRun(runId);
      spinner.succeed('Run promoted');
      console.log(`  ${result.data.message}`);
    } catch (err) {
      spinner.fail('Failed to promote run');
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

runCommand
  .command('list')
  .description('List recent runs')
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals();
    const client = await createClient(globalOpts);
    
    try {
      const result = await client.listRuns();
      
      if (globalOpts.json) {
        console.log(JSON.stringify(result.data.data, null, 2));
      } else {
        console.log();
        console.log(chalk.bold('Recent runs'));
        result.data.data.forEach(r => {
          const statusColor = r.status === 'promoted' ? chalk.green :
                              r.status === 'prepared' ? chalk.yellow :
                              r.status === 'running' ? chalk.blue : chalk.gray;
          console.log(`  v${r.policyVersion} ${statusColor(r.status)} ${chalk.dim(r.id)}`);
        });
      }
    } catch (err) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });
