#!/usr/bin/env node
/**
 * deny-self-edit.js — PreToolUse hook for ci-dev-agent.
 *
 * Blocks Edit/Write/NotebookEdit tool calls that target any file inside the
 * installed plugin directory. As of v2.5.0 the skills write their generated
 * artifacts (.iflw, .mmap, scripts, parameters.prop, etc.) under the user's
 * <cwd>/.ci-dev-agent/runs/<artifact-id>/ — outside the plugin entirely — so
 * the deny is unconditional within the plugin tree (no .tmp/ carve-out).
 *
 * Input: a JSON object on stdin shaped like:
 *   { "tool_input": { "file_path": "..." } }
 * or for NotebookEdit:
 *   { "tool_input": { "notebook_path": "..." } }
 *
 * Exit codes:
 *   0  — allow the tool call (path is anywhere outside the plugin install)
 *   2  — deny the tool call. Stderr contains a message explaining why,
 *        which Claude Code surfaces to the agent so it can self-correct.
 *
 * The CLAUDE_PLUGIN_ROOT environment variable is set by Claude Code to the
 * absolute path of this plugin's install directory. We compare resolved
 * absolute paths to determine whether a target is "inside the plugin".
 */

'use strict';

const path = require('path');

// ── stdin → JSON ────────────────────────────────────────────────────────────
function readStdinSync() {
  // Synchronous read using fs.readFileSync('/dev/stdin') — works on all
  // platforms via the file descriptor 0 alias. On Windows, `/dev/stdin`
  // isn't valid, but `0` (the file descriptor) is.
  const fs = require('fs');
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

let payload;
try {
  const raw = readStdinSync();
  payload = raw.trim() ? JSON.parse(raw) : {};
} catch (err) {
  // Malformed input → allow. We're not the input validator, we're the
  // deny-hook for a specific path pattern. If we can't parse the input,
  // we have no basis to deny — let the harness handle it.
  process.exit(0);
}

const toolInput = (payload && payload.tool_input) || {};
const target = toolInput.file_path || toolInput.notebook_path || '';

if (!target) {
  // No path in the input → not a file-write call we recognize → allow.
  process.exit(0);
}

// ── Path normalization ──────────────────────────────────────────────────────
// Goal: turn whatever path string the harness sends us into a stable absolute
// path that we can compare against the plugin root with `startsWith`.
//
// Cross-platform concerns:
//   Windows
//     - Backslashes (`C:\foo\bar`)            → fold to forward slashes
//     - Git-bash / MSYS (`/c/foo/bar`)        → fold to `C:/foo/bar`
//     - Cygwin (`/cygdrive/c/foo/bar`)        → fold to `C:/foo/bar`
//     - Case-insensitive NTFS                 → realpath canonicalizes
//   macOS
//     - APFS / HFS+ default case-insensitive  → realpath canonicalizes
//     - npm global often installed via symlink (Homebrew `/usr/local/bin`
//       → `/opt/homebrew/...` on Apple Silicon, asdf/nvm shims)
//                                             → realpath resolves to the
//                                                actual install path
//   Linux
//     - ext4 default case-sensitive           → realpath is a no-op for case
//     - Symlinks (nvm, npm prefix overrides, asdf)
//                                             → realpath resolves them
//
// We use `fs.realpathSync.native` which is the OS's native canonicalization
// (case-folds where the filesystem case-folds, follows symlinks). For paths
// that don't exist on disk (test fixtures, hypothetical targets), realpath
// throws — we fall back to `path.resolve` which at least makes it absolute,
// and we apply manual case-folding on Windows + macOS so test fixtures still
// compare equal even when the file doesn't exist.
const fs = require('fs');

const HOST_CASE_INSENSITIVE =
  process.platform === 'win32' || process.platform === 'darwin';

function normalize(p) {
  let s = String(p || '');

  // Git-bash / MSYS-style `/c/...` → `C:/...`
  s = s.replace(/^\/([a-zA-Z])\//, '$1:/');
  // Cygwin-style `/cygdrive/c/...` → `C:/...`
  s = s.replace(/^\/cygdrive\/([a-zA-Z])\//, '$1:/');

  // Best-effort canonical path: try realpath (resolves symlinks + folds case
  // on case-insensitive filesystems). Fall back to path.resolve for paths
  // that don't exist on disk yet (which is normal for hooks — the agent may
  // be trying to *create* a file).
  let resolved;
  try {
    resolved = fs.realpathSync.native(s);
  } catch {
    resolved = path.resolve(s);
  }

  // Uniform separator for comparison.
  resolved = resolved.replace(/\\/g, '/');

  // Manual case-folding on case-insensitive hosts. realpath canonicalizes
  // case for paths that exist on disk, but test fixtures and not-yet-created
  // files still need this so e.g. `C:/VSProjects/...` and `c:/vsprojects/...`
  // compare equal.
  if (HOST_CASE_INSENSITIVE) {
    resolved = resolved.toLowerCase();
  }
  return resolved;
}

const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
if (!pluginRoot) {
  // No plugin root means we're not running under Claude Code's plugin
  // harness — we have nothing to compare against. Allow.
  process.exit(0);
}

const normalizedTarget = normalize(target);
const normalizedRoot = normalize(pluginRoot);

// ── Rule 1: outside the plugin → allow ──────────────────────────────────────
// User's project files (including `<cwd>/.ci-dev-agent/runs/<artifact-id>/`
// where the skills stage generated artifacts), system temp, anywhere else —
// not our concern.
if (!normalizedTarget.startsWith(normalizedRoot + '/') &&
    normalizedTarget !== normalizedRoot) {
  process.exit(0);
}

// ── Rule 2: anywhere inside the plugin → deny ──────────────────────────────
// As of v2.5.0, the skills no longer write inside the plugin directory at
// all — generated `.iflw`, `.mmap`, scripts etc. live under the user's
// `<cwd>/.ci-dev-agent/runs/<artifact-id>/`. So this deny is unconditional:
// SKILL.md, every references/ file (guides, phases, metadata, samples),
// tools/, bin/, scripts/, hooks/ (the hook can't disable itself),
// config/*.template, .claude-plugin/*, package.json, LICENSE, README.md,
// and the shared installed-package-rules.md file itself — all denied.
process.stderr.write(
  '\n' +
  '╔════════════════════════════════════════════════════════════════════════╗\n' +
  '║  ci-dev-agent: write blocked — installed package is read-only          ║\n' +
  '╚════════════════════════════════════════════════════════════════════════╝\n' +
  '\n' +
  `Blocked target: ${target}\n` +
  `Plugin root:    ${pluginRoot}\n` +
  '\n' +
  'The ci-dev-agent plugin is installed via npm and its files are immutable\n' +
  'at runtime. Generated artifacts (.iflw, .mmap, scripts, parameters.prop,\n' +
  'etc.) belong in the user\'s current project directory under:\n' +
  '\n' +
  '    <cwd>/.ci-dev-agent/runs/<artifact-id>/\n' +
  '\n' +
  'where <cwd> is wherever Claude Code is opened. That path is outside the\n' +
  'plugin and freely writable. See skills/_shared/installed-package-rules.md.\n' +
  '\n' +
  'To suggest a change to a SKILL.md, guide, metadata file, or any other\n' +
  'reference shipped with this package:\n' +
  '  1. Surface the change as a report in the Phase H completion summary\n' +
  '     under the "New Error Discoveries" block.\n' +
  '  2. Ask the user to forward it to the package maintainer by filing an\n' +
  '     issue at https://github.com/Vishal1889/ci-dev-agent/issues.\n' +
  '\n'
);
process.exit(2);
