const { existsSync, readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');

const AGENTS_DIRECTORY = 'apps/ai';
const WORKSPACE_ROOT = /^(apps\/ai\/[^/]+|apps\/[^/]+|packages\/[^/]+)(?:\/|$)/;
const LOCK_FILE = 'package-lock.json';
const COPY_INSTRUCTION = /^(COPY|ADD)\s+(.*)$/i;
const FLAG = /^--\S+$/;

const logicalLines = (dockerfile) =>
  dockerfile
    .replace(/\\\r?\n/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.trim());

const parseArguments = (argumentsText) => {
  const text = argumentsText.trim();
  const tokens = text.startsWith('[') ? JSON.parse(text) : text.split(/\s+/);
  if (!Array.isArray(tokens) || tokens.some((token) => typeof token !== 'string')) {
    throw new Error('the arguments are not a list of words');
  }
  const flags = tokens.filter((token) => FLAG.test(token));
  const paths = tokens.filter((token) => !FLAG.test(token));
  if (paths.length < 2) throw new Error('needs at least one source and a destination');
  return {
    from: flags.find((flag) => flag.startsWith('--from='))?.slice('--from='.length),
    sources: paths.slice(0, -1),
  };
};

const workspaceRootOf = (source, fromStage) => {
  if (fromStage !== undefined && !source.startsWith('/app/')) return null;
  const relative = source.replace(/^\/?app\//, '').replace(/^\.\//, '');
  if (relative === '.' || relative === '') return null;
  if (/[$*?[\]{}]/.test(relative)) throw new Error(`cannot resolve the source "${source}"`);
  return WORKSPACE_ROOT.exec(relative)?.[1] ?? null;
};

const copiedWorkspaceRoots = (dockerfile) => {
  const roots = new Set();
  for (const line of logicalLines(dockerfile)) {
    const match = COPY_INSTRUCTION.exec(line);
    if (match === null) continue;
    try {
      const { from, sources } = parseArguments(match[2]);
      for (const source of sources) {
        const root = workspaceRootOf(source, from);
        if (root !== null) roots.add(root);
      }
    } catch (error) {
      throw new Error(`cannot parse "${line}": ${error.message}`);
    }
  }
  return roots;
};

const stripSlash = (pattern) => pattern.replace(/^\//, '');

const isCovered = (patterns, root) =>
  patterns.some((pattern) => stripSlash(pattern) === `${root}/**`);

const missingWatchPatterns = (dockerfile, watchPatterns) => {
  const missing = [...copiedWorkspaceRoots(dockerfile)]
    .filter((root) => !isCovered(watchPatterns, root))
    .map((root) => `/${root}/**`);
  const lockCovered = watchPatterns.some((pattern) => stripSlash(pattern) === LOCK_FILE);
  return lockCovered ? missing : [...missing, `/${LOCK_FILE}`];
};

const agentDirectories = (repositoryRoot) =>
  readdirSync(path.join(repositoryRoot, AGENTS_DIRECTORY), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(AGENTS_DIRECTORY, entry.name))
    .filter((directory) => existsSync(path.join(repositoryRoot, directory, 'railway.json')));

const checkAgent = (repositoryRoot, directory) => {
  const config = JSON.parse(
    readFileSync(path.join(repositoryRoot, directory, 'railway.json'), 'utf8'),
  );
  const dockerfile = readFileSync(path.join(repositoryRoot, config.build.dockerfilePath), 'utf8');
  const patterns = config.build.watchPatterns;
  if (!Array.isArray(patterns)) return [`${directory}/railway.json has no build.watchPatterns`];
  try {
    return missingWatchPatterns(dockerfile, patterns).map(
      (pattern) =>
        `${directory}/railway.json: build.watchPatterns lacks ${pattern}, which its Dockerfile copies`,
    );
  } catch (error) {
    return [`${config.build.dockerfilePath}: ${error.message}`];
  }
};

const main = () => {
  const repositoryRoot = process.cwd();
  const problems = agentDirectories(repositoryRoot).flatMap((directory) =>
    checkAgent(repositoryRoot, directory),
  );
  for (const problem of problems) console.error(problem);
  if (problems.length > 0) process.exit(1);
};

if (require.main === module) main();

module.exports = { agentDirectories, copiedWorkspaceRoots, missingWatchPatterns };
