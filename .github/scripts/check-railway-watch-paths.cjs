const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');

const WORKSPACE_ROOT = /^(apps\/ai\/[^/]+|apps\/[^/]+|packages\/[^/]+)(?:\/|$)/;
const LOCK_FILE = 'package-lock.json';

const copiedWorkspaceRoots = (dockerfile) => {
  const roots = new Set();
  for (const line of dockerfile.split('\n')) {
    const match = /^COPY\s+(?:--\S+\s+)*(\S+)\s+\S+\s*$/.exec(line.trim());
    if (match === null) continue;
    const source = match[1].replace(/^\/?app\//, '').replace(/^\.\//, '');
    const root = WORKSPACE_ROOT.exec(source);
    if (root !== null) roots.add(root[1]);
  }
  return roots;
};

const isCovered = (patterns, root) =>
  patterns.some((pattern) => pattern.replace(/^\//, '') === `${root}/**`);

const missingWatchPatterns = (dockerfile, watchPatterns) => {
  const missing = [...copiedWorkspaceRoots(dockerfile)]
    .filter((root) => !isCovered(watchPatterns, root))
    .map((root) => `/${root}/**`);
  const lockCovered = watchPatterns.some((pattern) => pattern.replace(/^\//, '') === LOCK_FILE);
  return lockCovered ? missing : [...missing, `/${LOCK_FILE}`];
};

const checkAgent = (agentDirectory) => {
  const config = JSON.parse(readFileSync(path.join(agentDirectory, 'railway.json'), 'utf8'));
  const dockerfile = readFileSync(config.build.dockerfilePath, 'utf8');
  const patterns = config.build.watchPatterns;
  if (!Array.isArray(patterns)) {
    return [`${agentDirectory}/railway.json has no build.watchPatterns`];
  }
  return missingWatchPatterns(dockerfile, patterns).map(
    (pattern) =>
      `${agentDirectory}/railway.json: build.watchPatterns lacks ${pattern}, which its Dockerfile copies`,
  );
};

const main = () => {
  const directories = process.argv.slice(2);
  const problems = directories
    .filter((directory) => existsSync(path.join(directory, 'railway.json')))
    .flatMap(checkAgent);
  for (const problem of problems) console.error(problem);
  if (problems.length > 0) process.exit(1);
};

if (require.main === module) main();

module.exports = { copiedWorkspaceRoots, missingWatchPatterns };
