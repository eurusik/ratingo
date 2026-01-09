# @ratingo/cli

CLI for Ratingo policy management.

## Installation

```bash
npm install
npm run build --workspace=@ratingo/cli
```

## Usage

```bash
npx ratingo <command>
```

On first run, CLI will prompt for your admin token and save it to `~/.ratingo`.

### Commands

```bash
# Policy management
npx ratingo policy dry-run ./policy.json          # Test policy on sample
npx ratingo policy dry-run ./policy.json --full   # Test on full catalog
npx ratingo policy create ./policy.json           # Create draft policy
npx ratingo policy list                           # List all policies

# Run management
npx ratingo run prepare <policy-id>               # Start evaluation
npx ratingo run status <run-id>                   # Get run status
npx ratingo run status <run-id> --watch           # Watch progress live
npx ratingo run promote <run-id>                  # Activate policy
npx ratingo run list                              # List recent runs

# Full deployment flow
npx ratingo deploy ./policy.json                  # dry-run → create → prepare → watch → promote
npx ratingo deploy ./policy.json -y               # Skip confirmations (CI mode)
```

### Global Options

```bash
--base-url <url>   API base URL (default: https://api.ratingo.top/api)
--token <token>    Auth token (overrides saved token)
--json             Output as JSON
--verbose          Verbose output
--no-color         Disable colors
```

### Token Management

Token is stored in `~/.ratingo` and automatically refreshed on 401 errors.

You can also set token via environment variable:
```bash
export RATINGO_TOKEN="your-token"
```

Or pass directly:
```bash
npx ratingo --token "your-token" policy list
```

## Example

```bash
# Full deployment
npx ratingo deploy ./policy.example.json

# Or step by step
npx ratingo policy dry-run ./policy.json
npx ratingo policy create ./policy.json
# note the policy ID from output
npx ratingo run prepare <policy-id>
# note the run ID from output
npx ratingo run status <run-id> --watch
npx ratingo run promote <run-id>
```
