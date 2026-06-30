#!/usr/bin/env bash
# Smoke tests for hooks/deny-self-edit.js — the PreToolUse hook that blocks
# Edit/Write/NotebookEdit calls against files inside the installed plugin.
#
# Usage:   bash hooks/deny-self-edit.test.sh
# Exit:    0 if all cases pass, 1 otherwise.
#
# Each case feeds a fake tool-call JSON to the hook, captures its exit code,
# and compares against the expected outcome. Exit 0 = allow, 2 = deny.

set -u

# Resolve this script's directory so the tests work regardless of CWD.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOK="$SCRIPT_DIR/deny-self-edit.js"

PASS=0
FAIL=0

run_case() {
  local name="$1"
  local expected="$2"
  local input="$3"
  local actual
  actual=$(echo "$input" | CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" node "$HOOK" >/dev/null 2>&1; echo $?)
  if [ "$actual" = "$expected" ]; then
    echo "  PASS  $name"
    PASS=$((PASS+1))
  else
    echo "  FAIL  $name  (expected exit $expected, got $actual)"
    FAIL=$((FAIL+1))
  fi
}

# Like run_case but does NOT set CLAUDE_PLUGIN_ROOT. Simulates user-scope hook
# registration where the plugin harness doesn't inject the env var — the
# hook must self-derive the plugin root from __dirname.
run_case_no_env() {
  local name="$1"
  local expected="$2"
  local input="$3"
  local actual
  actual=$(echo "$input" | env -u CLAUDE_PLUGIN_ROOT node "$HOOK" >/dev/null 2>&1; echo $?)
  if [ "$actual" = "$expected" ]; then
    echo "  PASS  $name"
    PASS=$((PASS+1))
  else
    echo "  FAIL  $name  (expected exit $expected, got $actual)"
    FAIL=$((FAIL+1))
  fi
}

echo
echo "Testing hooks/deny-self-edit.js"
echo "Plugin root: $PLUGIN_ROOT"
echo

# ── Denied cases (inside plugin — as of v2.5.0 there are NO exceptions) ─────
run_case "deny  SKILL.md"                 2 "{\"tool_input\":{\"file_path\":\"$PLUGIN_ROOT/skills/ci-iflow-developer/SKILL.md\"}}"
run_case "deny  known-errors.md"          2 "{\"tool_input\":{\"file_path\":\"$PLUGIN_ROOT/skills/ci-iflow-developer/references/guides/known-errors.md\"}}"
run_case "deny  adapter metadata json"    2 "{\"tool_input\":{\"file_path\":\"$PLUGIN_ROOT/skills/ci-iflow-developer/references/metadata/adapters/sftp_sender.json\"}}"
run_case "deny  minimal-iflow sample"     2 "{\"tool_input\":{\"file_path\":\"$PLUGIN_ROOT/skills/ci-iflow-developer/references/minimal-iflows/07-exception-subprocess.iflw\"}}"
run_case "deny  shared rules file"        2 "{\"tool_input\":{\"file_path\":\"$PLUGIN_ROOT/skills/_shared/installed-package-rules.md\"}}"
run_case "deny  plugin.json"              2 "{\"tool_input\":{\"file_path\":\"$PLUGIN_ROOT/.claude-plugin/plugin.json\"}}"
run_case "deny  hook script itself"       2 "{\"tool_input\":{\"file_path\":\"$PLUGIN_ROOT/hooks/deny-self-edit.js\"}}"

# v2.5.0 change — writes inside skills/<skill>/.tmp/ are NO LONGER allowed.
# Skills now write to <cwd>/.ci-dev-agent/runs/<artifact-id>/ instead.
run_case "deny  legacy .tmp/ path"        2 "{\"tool_input\":{\"file_path\":\"$PLUGIN_ROOT/skills/ci-iflow-developer/.tmp/abc/foo.iflw\"}}"
run_case "deny  legacy .tmp/ deep nested" 2 "{\"tool_input\":{\"file_path\":\"$PLUGIN_ROOT/skills/ci-iflow-developer/.tmp/CHS/src/main/resources/scenarioflows/integrationflow/x.iflw\"}}"

# ── Allowed cases (outside the plugin) ──────────────────────────────────────
# Anywhere outside CLAUDE_PLUGIN_ROOT is fine — user's project, system temp,
# their home directory, etc. The v2.5.0 working-directory convention
# (<cwd>/.ci-dev-agent/runs/<artifact-id>/) lives in user project, so it's
# covered by these "outside the plugin" cases.
run_case "allow user's project file"        0 '{"tool_input":{"file_path":"c:/Users/foo/myproject/iflow.iflw"}}'
run_case "allow project .ci-dev-agent/runs" 0 '{"tool_input":{"file_path":"c:/Users/foo/myproject/.ci-dev-agent/runs/CHS_OTC_RackManifest/src/main/resources/scenarioflows/integrationflow/x.iflw"}}'
run_case "allow project .ci-dev-agent/.gitignore" 0 '{"tool_input":{"file_path":"c:/Users/foo/myproject/.ci-dev-agent/.gitignore"}}'

# ── Edge cases ──────────────────────────────────────────────────────────────
# Windows-native path with backslashes — built via Node so the JSON escaping
# is correct. Real-world Claude Code calls on Windows do emit `\\` in
# file_path when the model thinks in native Windows paths.
node -e "
  const root = process.env.ROOT.replace(/\//g, '\\\\\\\\');
  process.stdout.write(JSON.stringify({tool_input:{file_path: root + '\\\\\\\\skills\\\\\\\\ci-iflow-developer\\\\\\\\SKILL.md'}}));
" ROOT="$PLUGIN_ROOT" > /tmp/win-path-test.json 2>/dev/null || \
ROOT="$PLUGIN_ROOT" node -e "
  const root = process.env.ROOT.replace(/\//g, '\\\\');
  process.stdout.write(JSON.stringify({tool_input:{file_path: root + '\\\\skills\\\\ci-iflow-developer\\\\SKILL.md'}}));
" > /tmp/win-path-test.json
actual=$(cat /tmp/win-path-test.json | CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" node "$HOOK" >/dev/null 2>&1; echo $?)
rm -f /tmp/win-path-test.json
if [ "$actual" = "2" ]; then
  echo "  PASS  deny  Windows backslash path"
  PASS=$((PASS+1))
else
  echo "  FAIL  deny  Windows backslash path  (expected exit 2, got $actual)"
  FAIL=$((FAIL+1))
fi

run_case "allow empty file_path"          0 '{"tool_input":{}}'
run_case "allow no tool_input"            0 '{}'
run_case "allow malformed JSON"           0 'not json at all'
run_case "allow NotebookEdit on user nb"  0 '{"tool_input":{"notebook_path":"c:/Users/foo/notebook.ipynb"}}'
run_case "deny  NotebookEdit on plugin"   2 "{\"tool_input\":{\"notebook_path\":\"$PLUGIN_ROOT/skills/ci-iflow-developer/SKILL.md\"}}"

# ── User-scope hook (no CLAUDE_PLUGIN_ROOT env var) ─────────────────────────
# v2.6.0 change: the hook is now registered in ~/.claude/settings.json (user-
# scope) on macOS because plugin-scope hooks don't load there. User-scope
# hook commands don't get CLAUDE_PLUGIN_ROOT injected — the hook self-derives
# from __dirname. Verify the deny still fires.
run_case_no_env "deny  SKILL.md (no env)"     2 "{\"tool_input\":{\"file_path\":\"$PLUGIN_ROOT/skills/ci-iflow-developer/SKILL.md\"}}"
run_case_no_env "allow user project (no env)" 0 '{"tool_input":{"file_path":"c:/Users/foo/myproject/iflow.iflw"}}'

# ── Cache path (the macOS skill editor target) ──────────────────────────────
# v2.6.0 change: the hook now also denies writes to the Claude Code plugin
# cache at ~/.claude/plugins/cache/ci-plugins/ci-dev-agent/<version>/. This
# is where the skill editor on macOS reads and writes — without explicit
# coverage, edits to the cache copy would slip past the deny. We use Node to
# build the platform-correct home-derived path.
CACHE_TEST_JSON="$(node -e '
  const path = require("path"); const os = require("os");
  const f = path.join(os.homedir(), ".claude", "plugins", "cache",
                      "ci-plugins", "ci-dev-agent", "2.5.1",
                      "skills", "ci-iflow-developer", "SKILL.md");
  process.stdout.write(JSON.stringify({tool_input: {file_path: f}}));
')"
actual=$(echo "$CACHE_TEST_JSON" | CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" node "$HOOK" >/dev/null 2>&1; echo $?)
if [ "$actual" = "2" ]; then
  echo "  PASS  deny  cache path (skill editor target on macOS)"
  PASS=$((PASS+1))
else
  echo "  FAIL  deny  cache path (expected exit 2, got $actual)"
  FAIL=$((FAIL+1))
fi
# Same test without the env var (user-scope mode):
actual=$(echo "$CACHE_TEST_JSON" | env -u CLAUDE_PLUGIN_ROOT node "$HOOK" >/dev/null 2>&1; echo $?)
if [ "$actual" = "2" ]; then
  echo "  PASS  deny  cache path (no env)"
  PASS=$((PASS+1))
else
  echo "  FAIL  deny  cache path (no env) (expected exit 2, got $actual)"
  FAIL=$((FAIL+1))
fi

# ── Cross-platform: case-folding (macOS APFS, Windows NTFS) ─────────────────
# Convert the plugin root to UPPER and lower case and confirm both are caught.
# On case-sensitive Linux ext4 these paths name different files and would not
# match — but our manual fold is only enabled on win32/darwin, so on Linux
# these specific cases legitimately exit 0 (allow) and we skip them there.
case "$(uname -s)" in
  Darwin*|MINGW*|MSYS*|CYGWIN*)
    UPPER="$(echo "$PLUGIN_ROOT" | tr '[:lower:]' '[:upper:]')"
    LOWER="$(echo "$PLUGIN_ROOT" | tr '[:upper:]' '[:lower:]')"
    run_case "deny  uppercase path variant"  2 "{\"tool_input\":{\"file_path\":\"$UPPER/skills/ci-iflow-developer/SKILL.md\"}}"
    run_case "deny  lowercase path variant"  2 "{\"tool_input\":{\"file_path\":\"$LOWER/skills/ci-iflow-developer/SKILL.md\"}}"
    ;;
  *)
    echo "  SKIP  case-folding tests (Linux ext4 is case-sensitive)"
    ;;
esac

# ── Cross-platform: symlink resolution (npm prefix often symlinked on mac/Linux) ──
# Create a temp symlink pointing at the plugin root, then send a path that
# goes through the symlink. The hook should resolve through realpath and
# still recognize the target as inside the plugin.
#
# On Windows git-bash, `ln -s` to a directory creates a copy, not a real
# symlink — so this test only runs on macOS/Linux where `ln -s` works.
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    echo "  SKIP  symlink tests (git-bash ln -s doesn't create real symlinks on Windows)"
    ;;
  *)
    if command -v ln >/dev/null 2>&1; then
      SYMLINK_DIR="$(mktemp -d)"
      if ln -s "$PLUGIN_ROOT" "$SYMLINK_DIR/plugin-link" 2>/dev/null && [ -L "$SYMLINK_DIR/plugin-link" ]; then
        run_case "deny  path through a symlink"  2 "{\"tool_input\":{\"file_path\":\"$SYMLINK_DIR/plugin-link/skills/ci-iflow-developer/SKILL.md\"}}"
        # v2.5.0: legacy .tmp/ inside the plugin is also denied (no allowlist).
        run_case "deny  legacy .tmp/ via symlink" 2 "{\"tool_input\":{\"file_path\":\"$SYMLINK_DIR/plugin-link/skills/ci-iflow-developer/.tmp/abc/foo.iflw\"}}"
        rm -f "$SYMLINK_DIR/plugin-link"
      else
        echo "  SKIP  symlink tests (ln -s failed or not a real symlink)"
      fi
      rm -rf "$SYMLINK_DIR" 2>/dev/null
    else
      echo "  SKIP  symlink tests (ln command unavailable)"
    fi
    ;;
esac

echo
echo "----------------------------------------"
echo "Results: $PASS passed, $FAIL failed"
echo "----------------------------------------"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
