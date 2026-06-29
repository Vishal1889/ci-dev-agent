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

echo
echo "Testing hooks/deny-self-edit.js"
echo "Plugin root: $PLUGIN_ROOT"
echo

# ── Denied cases (inside plugin, not in .tmp/) ──────────────────────────────
run_case "deny  SKILL.md"                 2 "{\"tool_input\":{\"file_path\":\"$PLUGIN_ROOT/skills/ci-iflow-developer/SKILL.md\"}}"
run_case "deny  known-errors.md"          2 "{\"tool_input\":{\"file_path\":\"$PLUGIN_ROOT/skills/ci-iflow-developer/references/guides/known-errors.md\"}}"
run_case "deny  adapter metadata json"    2 "{\"tool_input\":{\"file_path\":\"$PLUGIN_ROOT/skills/ci-iflow-developer/references/metadata/adapters/sftp_sender.json\"}}"
run_case "deny  minimal-iflow sample"     2 "{\"tool_input\":{\"file_path\":\"$PLUGIN_ROOT/skills/ci-iflow-developer/references/minimal-iflows/07-exception-subprocess.iflw\"}}"
run_case "deny  shared rules file"        2 "{\"tool_input\":{\"file_path\":\"$PLUGIN_ROOT/skills/_shared/installed-package-rules.md\"}}"
run_case "deny  plugin.json"              2 "{\"tool_input\":{\"file_path\":\"$PLUGIN_ROOT/.claude-plugin/plugin.json\"}}"
run_case "deny  hook script itself"       2 "{\"tool_input\":{\"file_path\":\"$PLUGIN_ROOT/hooks/deny-self-edit.js\"}}"

# ── Allowed cases (inside .tmp/, or outside the plugin entirely) ────────────
run_case "allow user's project file"      0 '{"tool_input":{"file_path":"c:/Users/foo/myproject/iflow.iflw"}}'
run_case "allow .tmp/ direct child"       0 "{\"tool_input\":{\"file_path\":\"$PLUGIN_ROOT/skills/ci-iflow-developer/.tmp/abc/foo.iflw\"}}"
run_case "allow .tmp/ deeply nested"      0 "{\"tool_input\":{\"file_path\":\"$PLUGIN_ROOT/skills/ci-iflow-developer/.tmp/CHS_OTC_RackManifest/src/main/resources/scenarioflows/integrationflow/my_iflow.iflw\"}}"
run_case "allow .tmp/ under mm skill"     0 "{\"tool_input\":{\"file_path\":\"$PLUGIN_ROOT/skills/ci-sa-mm-developer/.tmp/MM_Foo/src/main/resources/mapping/x.mmap\"}}"

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

echo
echo "----------------------------------------"
echo "Results: $PASS passed, $FAIL failed"
echo "----------------------------------------"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
