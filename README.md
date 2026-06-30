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

The default npm global prefix on macOS and many Linux setups is root-owned, so `npm install -g` and the subsequent `ci-dev-agent setup` both require elevated privileges. On managed Macs the recommended flow is to activate privileges, run the setup commands under `sudo`, then deactivate. These are one-time operations.

**On SAP-managed Macs (and similar org-managed environments):**

1. **Activate elevated privileges** via your org's privilege management tool (e.g. SAP's "Request Administrator Privileges" — confirms in a dialog and grants temporary admin access, typically 20 minutes).

2. **Install the package:**

   ```bash
   sudo npm install -g ci-dev-agent
   ```

3. **Run setup** (still under `sudo`):

   ```bash
   sudo ci-dev-agent setup
   ```

   The interactive prompts will ask for your MCP server URL, OAuth client ID, OAuth authorize/token URLs, and tenant → destination mappings.

4. **Deactivate elevated privileges** (or let them expire).

5. **Restart Claude Code**, then type `/ci-iflow-developer` to begin.

> **Reconfiguring later:** the same elevated pattern applies. To change MCP credentials, tenant mappings, or to update the package, activate privileges and use `sudo`:
>
> ```bash
> sudo ci-dev-agent configure mcp        # update MCP credentials
> sudo ci-dev-agent configure tenants    # add/edit tenant mappings
> sudo npm update -g ci-dev-agent        # pull a newer release
> sudo ci-dev-agent uninstall            # remove from Claude Code
> ```
>
> Deactivate privileges when done. None of these operations need to be permanent or frequent — they're triggered when you actually need to change something.

**Direct-sudo alternative** (personal Macs / Linux workstations with direct `sudo` access — no privilege management tool):

```bash
sudo npm install -g ci-dev-agent
sudo ci-dev-agent setup
```

Same pattern, just without the activate/deactivate wrapper.

**User-owned Node alternative:** if you use a Node version manager (`nvm`, `volta`, `fnm`, `asdf`) or installed Node via Homebrew on Apple Silicon (`/opt/homebrew/`), the npm prefix is already user-owned. Run without `sudo`:

```bash
npm install -g ci-dev-agent
ci-dev-agent setup
```

This is the simplest flow and avoids needing privileges entirely, but it requires you to have chosen a user-scope Node installer at OS-setup time.

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

Prints the installed version, Node/platform info, and queries the npm registry for the latest published version. No elevation needed for the version check itself.

### Upgrade

The upgrade command follows the same elevation pattern as the initial install.

**On managed Macs (SAP-managed and similar):**

1. Activate elevated privileges
2. `sudo npm update -g ci-dev-agent`
3. Deactivate privileges
4. Restart Claude Code

Postinstall re-registers the hook with the freshly-installed path automatically. Your MCP credentials and tenant config in `~/.claude/ci-dev-agent/` are preserved — you do NOT need to re-enter them.

**On Macs / Linux with direct sudo access:**

```bash
sudo npm update -g ci-dev-agent
```

**On user-owned Node installs (nvm, volta, fnm, asdf, Homebrew on Apple Silicon):**

```bash
npm update -g ci-dev-agent
```

### Guided upgrade check

If you'd like to see what's available before running the update:

```bash
ci-dev-agent upgrade
```

`upgrade` checks the registry; when a newer version exists, it shows the upgrade command. When you're already on the latest, it exits with a "no upgrade needed" message. Use `--force` to force-reinstall the same version (handy if you suspect the local install is corrupted). No elevation needed for the check itself; the printed command still needs `sudo` on managed Macs.

The CLI also prints a small notice at the end of any `ci-dev-agent` command when a newer version is available (cached for 24 hours so the registry isn't hit on every invocation).


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
