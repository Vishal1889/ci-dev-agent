# ci-dev-agent

[Claude Code](https://claude.com/claude-code) skills for **SAP Cloud Integration** (CPI / Integration Suite) development — author iFlows, message mappings, and script collections from natural language, deploy them to your tenant, and debug failures end-to-end.

Distributed as a single npm package. One command installs everything; a short interactive wizard captures your MCP server credentials and tenant destinations.

## Requirements

- [Claude Code](https://claude.com/claude-code) installed and on your `PATH`
- Node.js ≥ 16
- An SAP BTP subaccount with the **ci-mcp-server-custom** MCP server deployed (the OAuth client ID, authorize URL, and token URL come from your subaccount service key)

## Install

```bash
npm install -g ci-dev-agent
ci-dev-agent setup
```

The setup wizard will:

1. Register the marketplace and enable the plugin in `~/.claude/settings.json`
2. Prompt for your MCP server URL + OAuth credentials and write `config/mcp.json`
3. Prompt for tenant → destination mappings and write `config/tenant-destination-config.json`

Restart Claude Code, then type `/ci-iflow-developer` to begin.

## Skills

| Skill | Use it for |
|---|---|
| `/ci-iflow-developer` | Build, upload, deploy, and debug Integration Flows (.iflw) |
| `/ci-sa-mm-developer` | Standalone Message Mapping artifacts (.mmap) |
| `/ci-sa-sc-developer` | Standalone Script Collections (Groovy / JavaScript bundles) |

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

## Update

```bash
npm update -g ci-dev-agent
```

Your MCP and tenant config are restored automatically.

## Uninstall

```bash
ci-dev-agent uninstall      # remove from Claude Code settings
npm uninstall -g ci-dev-agent
```

Your saved config in `~/.claude/ci-dev-agent/` is preserved — delete it manually for a clean slate.

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
