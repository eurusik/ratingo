import { Command } from 'commander';

import { policyCommand } from './commands/policy.js';
import { runCommand } from './commands/run.js';
import { deployCommand } from './commands/deploy.js';

const program = new Command();

program
  .name('ratingo')
  .description('Ratingo CLI for policy management')
  .version('0.1.0');

// Global options
program
  .option('--base-url <url>', 'API base URL', process.env.API_BASE || 'https://api.ratingo.top/api')
  .option('--token <token>', 'Auth token', process.env.RATINGO_TOKEN)
  .option('--json', 'Output as JSON')
  .option('--verbose', 'Verbose output')
  .option('--no-color', 'Disable colors');

// Register commands
program.addCommand(policyCommand);
program.addCommand(runCommand);
program.addCommand(deployCommand);

program.parse();
