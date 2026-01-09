import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as readline from 'node:readline';

const CONFIG_FILE = path.join(os.homedir(), '.ratingo');

interface Config {
  token?: string;
  baseUrl?: string;
}

export function loadConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // ignore
  }
  return {};
}

export function saveConfig(config: Config): void {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function clearToken(): void {
  const config = loadConfig();
  delete config.token;
  saveConfig(config);
}

export async function promptToken(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Enter your admin token: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function getToken(cliToken?: string): Promise<string> {
  // 1. CLI option has highest priority
  if (cliToken) return cliToken;

  // 2. Environment variable
  if (process.env.RATINGO_TOKEN) return process.env.RATINGO_TOKEN;

  // 3. Config file
  const config = loadConfig();
  if (config.token) return config.token;

  // 4. Interactive prompt
  console.log('No token found. You can get one from the admin panel.');
  const token = await promptToken();
  
  if (!token) {
    throw new Error('Token is required');
  }

  // Save for future use
  saveConfig({ ...config, token });
  console.log(`Token saved to ${CONFIG_FILE}\n`);
  
  return token;
}
