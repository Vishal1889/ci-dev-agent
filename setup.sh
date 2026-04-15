#!/usr/bin/env bash
# setup.sh — Register ci-marketplace and enable the ci-dev-plugin for Claude Code
# Works on macOS, Linux, and Windows (Git Bash / MSYS2)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MARKETPLACE_DIR="$SCRIPT_DIR"

# Normalize path for Windows (convert /c/... to C:\...)
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    MARKETPLACE_DIR="$(cygpath -w "$MARKETPLACE_DIR")"
    ;;
esac

CLAUDE_SETTINGS="$HOME/.claude/settings.json"

echo "ci-marketplace installer"
echo "────────────────────────────────────────────"
echo "Marketplace: $MARKETPLACE_DIR"
echo ""

# ── Preflight ─────────────────────────────────────────────────────────────────
if ! command -v claude &>/dev/null; then
  echo "ERROR: 'claude' CLI not found. Install Claude Code first."
  exit 1
fi

if [ ! -f "$MARKETPLACE_DIR/.claude-plugin/marketplace.json" ]; then
  echo "ERROR: marketplace.json not found. Run this script from the repo root."
  exit 1
fi

# ── Register marketplace in Claude Code settings ─────────────────────────────
echo "Registering marketplace in Claude Code settings ..."

mkdir -p "$HOME/.claude"
if [ ! -f "$CLAUDE_SETTINGS" ]; then
  echo "{}" > "$CLAUDE_SETTINGS"
fi

node -e "
const fs = require('fs');
const settingsPath = process.argv[1];
const marketplacePath = process.argv[2];
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

if (!settings.extraKnownMarketplaces) settings.extraKnownMarketplaces = {};
settings.extraKnownMarketplaces['ci-marketplace'] = {
  source: { source: 'directory', path: marketplacePath }
};

if (!settings.enabledPlugins) settings.enabledPlugins = {};
settings.enabledPlugins['ci-dev-plugin@ci-marketplace'] = true;

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
" "$CLAUDE_SETTINGS" "$MARKETPLACE_DIR"

echo "  done: marketplace registered and plugin enabled"

# ── Clear plugin cache ────────────────────────────────────────────────────────
rm -rf "$HOME/.claude/plugins/cache/ci-marketplace" 2>/dev/null || true
echo "  done: plugin cache cleared"

# ── Generate .mcp.json if missing ─────────────────────────────────────────────
MCP_JSON="$SCRIPT_DIR/plugins/ci-dev-plugin/.mcp.json"
MCP_TEMPLATE="$SCRIPT_DIR/plugins/ci-dev-plugin/.mcp.json.template"

if [ ! -f "$MCP_JSON" ]; then
  if [ ! -f "$MCP_TEMPLATE" ]; then
    echo "ERROR: .mcp.json.template not found."
    exit 1
  fi

  echo "Generating .mcp.json from template ..."
  echo ""
  echo "  Your SAP BTP MCP server details are needed."
  echo "  (Find these in your BTP subaccount service key.)"
  echo ""

  read -rp "  MCP server URL (e.g. https://my-app.cfapps.us10.hana.ondemand.com/mcp): " MCP_URL
  read -rp "  OAuth client ID: " OAUTH_CLIENT_ID
  read -rp "  OAuth authorize URL (e.g. https://tenant.authentication.us10.hana.ondemand.com/oauth/authorize): " AUTH_URL
  read -rp "  OAuth token URL (e.g. https://tenant.authentication.us10.hana.ondemand.com/oauth/token): " TOKEN_URL

  node -e "
const fs = require('fs');
const tpl = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
const srv = tpl.mcpServers['ci-mcp-server-custom'];
srv.url = process.argv[2];
srv.oauth.clientId = process.argv[3];
srv.oauth.authorizeUrl = process.argv[4];
srv.oauth.tokenUrl = process.argv[5];
fs.writeFileSync(process.argv[6], JSON.stringify(tpl, null, 2) + '\n');
" "$MCP_TEMPLATE" "$MCP_URL" "$OAUTH_CLIENT_ID" "$AUTH_URL" "$TOKEN_URL" "$MCP_JSON"

  echo "  done: .mcp.json generated"
else
  echo "  .mcp.json already exists — skipping"
fi

# ── Install orchestration dashboard dependencies ─────────────────────────────
ORCH_DIR="$SCRIPT_DIR/plugins/ci-dev-plugin/orchestration"
if [ -f "$ORCH_DIR/package.json" ]; then
  echo "Installing orchestration dashboard dependencies ..."
  (cd "$ORCH_DIR" && npm install --silent)
  echo "  done: orchestration dependencies installed"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "────────────────────────────────────────────"
echo "Setup complete! Restart Claude Code to use the plugin."
echo ""
echo "Skills installed:"
echo "  ci-iflow-developer    — Integration Flow development"
echo "  ci-sa-mm-developer    — Standalone Message Mapping development"
echo "  ci-sa-sc-developer    — Standalone Script Collection development"
echo ""
echo "Orchestration dashboard:"
echo "  To enable, create .claude/ci-dev-plugin.local.md in your project with:"
echo "    ---"
echo "    orchestration_dashboard: true"
echo "    ---"
