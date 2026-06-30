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

The default npm global prefix on macOS and many Linux setups is root-owned, so `npm install -g` requires elevated privileges. The flow below requests elevation only for the install + ownership transfer, then drops it before running `ci-dev-agent setup` — this avoids accidentally creating root-owned files under your home directory that would block future operations.

**On SAP-managed Macs (and similar org environments):**

1. **Activate elevated privileges** via your org's privilege management tool (e.g. SAP's "Request Administrator Privileges" — confirms in a dialog and grants temporary admin access, typically 20 minutes).

2. **Install + take ownership** (both commands while privileges are active):

   ```bash
   sudo npm install -g ci-dev-agent
   sudo chown -R "$(whoami)" "$(npm config get prefix)/lib/node_modules" \
                             "$(npm config get prefix)/bin" \
                             "$(npm config get prefix)/share"
   ```

   The `chown` transfers the just-installed package directory to your user. After this one-time transfer, every future `npm install -g` and `npm update -g` works without elevation.

3. **Deactivate elevated privileges** (or just let them expire — you don't need them for the remaining steps).

4. **Run setup as your normal user** (no `sudo`):

   ```bash
   ci-dev-agent setup
   ```

   This writes to `~/.claude/settings.json` and `~/.claude/ci-dev-agent/` — both under your home directory. **Do NOT run `setup` with `sudo`** or while privileges are active — that would create root-owned files in your home dir, breaking future `ci-dev-agent` commands (you'd get `EACCES` on every non-elevated invocation).

5. **Restart Claude Code**, then type `/ci-iflow-developer` to begin.

**Direct-sudo alternative** (if you have direct `sudo` access without a privilege tool, on personal Macs / Linux workstations):

```bash
sudo npm install -g ci-dev-agent
sudo chown -R "$(whoami)" "$(npm config get prefix)/lib/node_modules" \
                          "$(npm config get prefix)/bin" \
                          "$(npm config get prefix)/share"
ci-dev-agent setup        # no sudo
```

**User-owned Node alternative:** if you use a Node version manager (`nvm`, `volta`, `fnm`, `asdf`) or installed Node via Homebrew on Apple Silicon (`/opt/homebrew/`), the npm prefix is already user-owned — skip the privilege steps entirely:

```bash
npm install -g ci-dev-agent
ci-dev-agent setup
```

**If you've already done `sudo npm install -g ci-dev-agent`** but skipped the `chown`: the install worked, but you'll hit `EACCES` later. Re-activate privileges briefly and run just the `chown` command above, then carry on.

### What setup does

1. Register the marketplace and enable the plugin in `~/.claude/settings.json`
2. Register a `PreToolUse` hook in `~/.claude/settings.json` that blocks `Edit`, `Write`, and `NotebookEdit` calls targeting files inside the installed plugin tree — including the Claude Code plugin cache copy. This prevents both the agent (via Edit tool) and the user (via the Claude Code skill editor UI) from silently mutating installed plugin files.
3. Prompt for your MCP server URL + OAuth credentials and write `config/mcp.json`
4. Prompt for tenant → destination mappings and write `config/tenant-destination-config.json`

Restart Claude Code, then type `/ci-iflow-developer` to begin.

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

### Check what's installed and what's available

```bash
ci-dev-agent version
```

Prints the installed version, Node/platform info, and queries the npm registry for the latest published version.

### Upgrade

```bash
npm update -g ci-dev-agent
```

That's it. Postinstall re-registers the hook with the freshly-installed path. Your MCP credentials and tenant config in `~/.claude/ci-dev-agent/` are preserved automatically — you do NOT need to re-enter them. Restart Claude Code after the update completes.

If you'd like a guided check first:

```bash
ci-dev-agent upgrade
```

`upgrade` checks the registry; when a newer version exists, it shows the upgrade command. When you're already on the latest, it exits with a "no upgrade needed" message. Use `--force` to force-reinstall the same version (handy if you suspect the local install is corrupted).

The CLI also prints a small notice at the end of any `ci-dev-agent` command when a newer version is available (cached for 24 hours so the registry isn't hit on every invocation).

### Update after a `sudo` install (macOS / Linux)

If you previously installed with `sudo npm install -g`, the existing files are root-owned and `npm update -g` will fail with `EACCES`. Fix it once, then update normally:

```bash
# One-time: transfer the npm prefix to your user
sudo chown -R "$(whoami)" "$(npm config get prefix)/lib/node_modules" \
                          "$(npm config get prefix)/bin" \
                          "$(npm config get prefix)/share"

# Then a normal update (no sudo)
npm update -g ci-dev-agent
```

After the one-time `chown`, every future `npm update -g ci-dev-agent` runs cleanly without `sudo`.

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
