# ci-dev-agent

[Claude Code](https://claude.com/claude-code) skills for **SAP Cloud Integration** (CPI / Integration Suite) development — author iFlows, message mappings, and script collections from natural language, deploy them to your tenant, and debug failures end-to-end.

Distributed as a single npm package. One command installs everything; a short interactive wizard captures your MCP server credentials and tenant destinations.

## Requirements

- [Claude Code](https://claude.com/claude-code) installed and on your `PATH`
- **Node.js ≥ 16** — [download the LTS installer from nodejs.org](https://nodejs.org/en/download). npm ships with Node, no separate install needed. *SAP / internal users: Node.js is also available via the Company Portal (search "Node.js" and install).*
- An SAP BTP subaccount with the **ci-mcp-server-custom** MCP server deployed (the OAuth client ID, authorize URL, and token URL come from your subaccount service key)

## Install

### Windows

```bash
npm install -g ci-dev-agent
ci-dev-agent setup
```

### macOS / Linux

The default npm global prefix on macOS and many Linux setups is root-owned, so a plain `npm install -g` fails with `EACCES`. **Do not run `npm install -g` with `sudo`** — root-owned files break later `ci-dev-agent setup` (which needs to lock skill files read-only as your user). Instead, transfer ownership of the npm prefix to your user once, then install normally:

```bash
# One-time fix: take ownership of npm's global prefix
sudo chown -R "$(whoami)" "$(npm config get prefix)/lib/node_modules" \
                          "$(npm config get prefix)/bin" \
                          "$(npm config get prefix)/share"

# Then install + run setup with your normal user (no sudo)
npm install -g ci-dev-agent
ci-dev-agent setup
```

After the one-time `chown`, every future `npm install -g <anything>` works without `sudo`.

**Alternative:** if you use a Node version manager (`nvm`, `volta`, `fnm`, `asdf`) or installed Node via Homebrew on Apple Silicon (`/opt/homebrew/`), the npm prefix is already user-owned — skip the `chown` step and just run `npm install -g ci-dev-agent && ci-dev-agent setup`.

### What setup does

1. Register the marketplace and enable the plugin in `~/.claude/settings.json`
2. Prompt for your MCP server URL + OAuth credentials and write `config/mcp.json`
3. Prompt for tenant → destination mappings and write `config/tenant-destination-config.json`
4. Lock the skill files read-only at the OS level (cross-platform: NTFS `READONLY` attribute on Windows, `chmod 0o444` on macOS/Linux) so the Claude Code skill editor cannot silently modify your installed plugin files

Restart Claude Code, then type `/ci-iflow-developer` to begin.

### Recovering from a previous `sudo npm install -g`

If you previously installed with `sudo npm install -g ci-dev-agent`, the skill files are root-owned and `ci-dev-agent setup` will warn that it could not chmod them. Fix it once with the same `chown` command as above, then re-run setup:

```bash
sudo chown -R "$(whoami)" "$(npm config get prefix)/lib/node_modules" \
                          "$(npm config get prefix)/bin" \
                          "$(npm config get prefix)/share"
ci-dev-agent setup
```

Subsequent `npm update -g ci-dev-agent` will then work without `sudo` and the read-only lock will apply correctly.

## Skills

| Skill | Use it for |
|---|---|
| `/ci-iflow-developer` | Build, upload, deploy, and debug Integration Flows (.iflw) |
| `/ci-sa-mm-developer` | Standalone Message Mapping artifacts (.mmap) |
| `/ci-sa-sc-developer` | Standalone Script Collections (Groovy / JavaScript bundles) |

## Working directory

While generating, deploying, and debugging artifacts, the skills stage their working files (`.iflw`, `.mmap`, Groovy/JS scripts, `parameters.prop`, MANIFEST.MF, XSDs — the full unpacked iFlow ZIP layout) in your **current project directory**, under:

```
<cwd>/.ci-dev-agent/runs/<artifact-id>/
```

Where `<cwd>` is wherever you opened Claude Code. The first time the skill creates `.ci-dev-agent/`, it drops a self-ignoring `.gitignore` containing `*` so the directory tree stays out of git automatically.

**Cleanup:** the working directory is removed automatically on a successful run. On PARTIAL or FAILED outcomes, it's kept so you can inspect what the skill generated. The Phase H completion summary tells you the exact path. Delete it yourself with `rm -rf .ci-dev-agent/runs/<artifact-id>` when you're done debugging.

**Why this location:** the v2.4.x and earlier releases wrote into the npm install directory (`skills/ci-iflow-developer/.tmp/`), which was wiped on every `npm update` and shared between concurrent runs. v2.5.0+ uses the project directory so working files survive package updates, isolate per project, and live where you naturally look for files in your workspace.

## Reconfiguring

```bash
ci-dev-agent configure mcp       # update MCP server credentials
ci-dev-agent configure tenants   # add/edit tenant destination mappings
```

Your config persists in `~/.claude/ci-dev-agent/` and survives `npm update` — you never have to re-enter credentials.

## Configuration files

After setup, your config lives in two places:

| File | Purpose |
|---|---|
| `~/.claude/ci-dev-agent/mcp-config.json` | Canonical MCP creds (URL, OAuth client ID, auth/token URLs). Survives upgrades. |
| `~/.claude/ci-dev-agent/tenant-config.json` | Canonical tenant → destination mappings. Survives upgrades. |
| `<package>/config/mcp.json` | Generated from the canonical config; read by Claude Code's MCP runtime. |
| `<package>/config/tenant-destination-config.json` | Generated from the canonical config; read by the skills. |

The `postinstall` hook regenerates the package-side files from the canonical ones on every `npm update`.

> If you ever delete `~/.claude/ci-dev-agent/` manually, re-run `ci-dev-agent setup` — without the canonical copies, `npm update` cannot restore the package-side config.

## Update

### Normal update (user-owned npm prefix)

```bash
npm update -g ci-dev-agent
```

The `postinstall` hook (runs automatically inside `npm update`) regenerates `config/mcp.json` and `config/tenant-destination-config.json` from your canonical copies in `~/.claude/ci-dev-agent/` and re-locks the new skill files read-only. **No further action needed.**

### Update after a `sudo` install (macOS / Linux)

If you previously installed with `sudo npm install -g`, the existing skill files are root-owned and `npm update` will fail with `EACCES` (or worse, silently leave a half-updated state). Fix it once, then update normally:

```bash
# One-time: transfer the npm prefix to your user
sudo chown -R "$(whoami)" "$(npm config get prefix)/lib/node_modules" \
                          "$(npm config get prefix)/bin" \
                          "$(npm config get prefix)/share"

# Then a normal update (no sudo)
ci-dev-agent uninstall            # unlocks the locked skill files
npm update -g ci-dev-agent        # pulls new version, postinstall re-locks
ci-dev-agent setup                # re-registers with Claude Code
```

After the one-time `chown`, every future `npm update -g ci-dev-agent` runs cleanly with just `npm update -g ci-dev-agent` — no `uninstall`/`setup` dance needed.

## Uninstall

```bash
ci-dev-agent uninstall      # remove from Claude Code settings
npm uninstall -g ci-dev-agent
```

Your saved config in `~/.claude/ci-dev-agent/` is preserved — delete it manually for a clean slate.

## Reporting new errors

The `/ci-iflow-developer` skill ships with a curated `known-errors.md` listing the deployment and runtime errors it knows how to fix. If the skill encounters and resolves an error that is **not** already in that file, it surfaces a structured **"New Error Discoveries"** block at the end of the Phase H completion summary, like:

```
New Error Discoveries (forward to maintainer for next release):
─────────────────────────────────────────────────────────────
## Error: "..."
- **Phase:** E
- **Root Cause:** ...
- **Fix:** ...
- **Grep key:** `...`
─────────────────────────────────────────────────────────────
```

**Please forward these blocks** to the maintainer by filing an issue at https://github.com/Vishal1889/ci-dev-agent/issues (suggested labels: `known-errors`, `triage`). They get added to `known-errors.md` in the next release, and **all users** receive the new entry on `npm update` — the skill learns once, everyone benefits.

The package is read-only at runtime (enforced by a `PreToolUse` hook), so the skill does NOT edit its own files. The "report → maintainer → release → npm update" cycle is the only way knowledge propagates across the user base.

## Tenant destination mapping

Each entry maps a logical environment name to the BTP **destination names** that the MCP server uses for design-time and runtime traffic:

```json
{
  "Trial": {
    "designTime": "CI_API_B",
    "runtime": "CI_Iflow_B"
  },
  "PROD": {
    "designTime": "CPI_PROD_API",
    "runtime": "CPI_PROD_RUNTIME"
  }
}
```

These destination names must match destinations you have configured in your BTP subaccount.

## MCP server name

All skills assume the MCP server is registered as **`ci-mcp-server-custom`** (full tool prefix: `mcp__ci-mcp-server-custom__`). This is fixed — do not edit the name in `config/mcp.json` manually.

## License

MIT — Vishal Jain
