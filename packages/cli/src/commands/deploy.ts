import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

import { createClient } from '../lib/api.js';
import { loadPolicyFile, printSummary, printRunStatus, sleep } from '../lib/utils.js';

export const deployCommand = new Command('deploy')
  .description('Full deployment flow: dry-run → create → prepare → watch → promote')
  .argument('<file>', 'Policy JSON file')
  .option('-y, --yes', 'Skip all confirmations')
  .option('--skip-dry-run', 'Skip dry-run step')
  .action(async (file, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals();
    const client = await createClient(globalOpts);
    const policy = loadPolicyFile(file);
    
    const readline = await import('node:readline');
    
    async function confirm(message: string): Promise<boolean> {
      if (opts.yes) return true;
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise<string>(resolve => {
        rl.question(`${message} (y/N) `, resolve);
      });
      rl.close();
      return answer.toLowerCase() === 'y';
    }
    
    if (!opts.skipDryRun) {
      console.log(chalk.bold('\n📋 Step 1: Dry-run'));
      const spinner = ora('Running dry-run evaluation...').start();
      
      try {
        const result = await client.dryRunDiff(policy, { mode: 'sample', limit: 5000 });
        spinner.succeed('Dry-run complete');
        printSummary(result.data.summary);
        
        const regressions = result.data.summary.newlyIneligible;
        if (regressions > 100) {
          console.log(chalk.yellow(`\n⚠️  Warning: ${regressions} items will become ineligible`));
        }
        
        if (!await confirm('\nContinue to create policy?')) {
          console.log('Cancelled');
          process.exit(0);
        }
      } catch (err) {
        spinner.fail('Dry-run failed');
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }
    }
    
    console.log(chalk.bold('\n📝 Step 2: Create policy'));
    let policyId: string;
    let policyVersion: number;
    
    {
      const spinner = ora('Creating policy...').start();
      try {
        const result = await client.createPolicy(policy);
        policyId = result.data.id;
        policyVersion = result.data.version;
        spinner.succeed(`Policy v${policyVersion} created`);
      } catch (err) {
        spinner.fail('Failed to create policy');
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }
    }
    
    console.log(chalk.bold('\n🔄 Step 3: Prepare (evaluate catalog)'));
    let runId: string;
    
    {
      const spinner = ora('Starting evaluation...').start();
      try {
        const result = await client.preparePolicy(policyId);
        runId = result.data.runId;
        spinner.succeed('Evaluation started');
      } catch (err) {
        spinner.fail('Failed to start evaluation');
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }
    }
    
    console.log(chalk.bold('\n⏳ Step 4: Waiting for evaluation...'));
    
    {
      const spinner = ora('Evaluating...').start();
      
      while (true) {
        const result = await client.getRunStatus(runId);
        const run = result.data;
        const progress = run.progress;
        
        if (progress) {
          const pct = progress.total > 0 
            ? ((progress.processed / progress.total) * 100).toFixed(0)
            : 0;
          spinner.text = `${progress.processed}/${progress.total} (${pct}%) | eligible: ${progress.eligible} | ineligible: ${progress.ineligible}`;
        }
        
        if (run.status === 'prepared') {
          spinner.succeed('Evaluation complete');
          printRunStatus(run);
          break;
        }
        
        if (run.status === 'failed') {
          spinner.fail('Evaluation failed');
          process.exit(1);
        }
        
        await sleep(3000);
      }
    }
    
    console.log(chalk.bold('\n🚀 Step 5: Promote'));
    
    if (!await confirm('Promote this policy to active?')) {
      console.log(`\nRun ID: ${chalk.dim(runId)}`);
      console.log('You can promote later with:');
      console.log(chalk.cyan(`  ratingo run promote ${runId}`));
      process.exit(0);
    }
    
    {
      const spinner = ora('Promoting...').start();
      try {
        await client.promoteRun(runId);
        spinner.succeed(`Policy v${policyVersion} is now active! 🎉`);
      } catch (err) {
        spinner.fail('Failed to promote');
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }
    }
  });
