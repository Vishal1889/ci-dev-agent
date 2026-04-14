#!/usr/bin/env bash
# setup.sh — Register ci-marketplace and enable the ci-dev-plugin for Claude Code
# Works on macOS, Linux, and Windows (Git Bash / MSYS2)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MARKETPLACE_DIR="$SCRIPT_DIR"
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

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "────────────────────────────────────────────"
echo "Setup complete! Restart Claude Code to use the plugin."
echo ""
echo "Skills installed:"
echo "  ci-iflow-developer    — Integration Flow development"
echo "  ci-sa-mm-developer    — Standalone Message Mapping development"
echo "  ci-sa-sc-developer    — Standalone Script Collection development"
