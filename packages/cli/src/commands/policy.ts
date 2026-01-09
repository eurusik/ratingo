import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

import { createClient } from '../lib/api.js';
import { loadPolicyFile, printSummary } from '../lib/utils.js';

export const policyCommand = new Command('policy')
  .description('Policy management (dry-run, create, list)');

policyCommand
  .command('dry-run <file>')
  .description('Test policy changes without applying')
  .option('--full', 'Evaluate full catalog (default: sample 5000)')
  .option('--limit <n>', 'Sample limit', '5000')
  .action(async (file, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals();
    const client = await createClient(globalOpts);
    const policy = loadPolicyFile(file);
    
    const spinner = ora('Running dry-run evaluation...').start();
    
    try {
      const limit = opts.full ? 100000 : parseInt(opts.limit, 10);
      const result = await client.dryRunDiff(policy, { mode: 'sample', limit });
      
      spinner.succeed('Dry-run complete');
      
      if (globalOpts.json) {
        console.log(JSON.stringify(result.data, null, 2));
      } else {
        printSummary(result.data.summary);
      }
    } catch (err) {
      spinner.fail('Dry-run failed');
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

policyCommand
  .command('create <file>')
  .description('Create a new draft policy')
  .action(async (file, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals();
    const client = await createClient(globalOpts);
    const policy = loadPolicyFile(file);
    
    const spinner = ora('Creating policy...').start();
    
    try {
      const result = await client.createPolicy(policy);
      spinner.succeed(`Policy v${result.data.version} created`);
      console.log(`  ID: ${chalk.dim(result.data.id)}`);
      console.log(`  ${result.data.message}`);
    } catch (err) {
      spinner.fail('Failed to create policy');
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

policyCommand
  .command('list')
  .description('List all policies')
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals();
    const client = await createClient(globalOpts);
    
    try {
      const result = await client.listPolicies();
      
      if (globalOpts.json) {
        console.log(JSON.stringify(result.data.data, null, 2));
      } else {
        console.log();
        console.log(chalk.bold('Policies'));
        result.data.data.forEach(p => {
          const statusColor = p.status === 'active' ? chalk.green : chalk.gray;
          console.log(`  v${p.version} ${statusColor(p.status)} ${chalk.dim(p.id)}`);
        });
      }
    } catch (err) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });
