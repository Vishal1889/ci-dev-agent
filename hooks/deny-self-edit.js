#!/usr/bin/env node
/**
 * deny-self-edit.js — PreToolUse hook for ci-dev-agent.
 *
 * Blocks Edit/Write/NotebookEdit tool calls that target files inside the
 * installed plugin directory, with a single narrow allowlist exception for
 * each skill's `.tmp/` staging area (where generated `.iflw` / `.mmap` /
 * script files live before MCP upload).
 *
 * Input: a JSON object on stdin shaped like:
 *   { "tool_input": { "file_path": "..." } }
 * or for NotebookEdit:
 *   { "tool_input": { "notebook_path": "..." } }
 *
 * Exit codes:
 *   0  — allow the tool call (path is outside the plugin, OR inside a
 *        `skills/<any-skill>/.tmp/` directory)
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
// On Windows, paths can arrive in several forms:
//   - Windows-native:  C:\VSProjects\ci-dev-agent\skills\...
//   - Forward-slash:   C:/VSProjects/ci-dev-agent/skills/...
//   - Git-bash/MSYS:   /c/VSProjects/ci-dev-agent/skills/...
//   - Cygwin:          /cygdrive/c/VSProjects/ci-dev-agent/skills/...
// All four need to normalize to the same absolute path so comparisons work.
function normalize(p) {
  let s = String(p || '');

  // Convert git-bash and MSYS-style /c/... to C:/...
  // (Match a leading slash + single letter + slash.)
  s = s.replace(/^\/([a-zA-Z])\//, '$1:/');

  // Convert Cygwin-style /cygdrive/c/... to C:/...
  s = s.replace(/^\/cygdrive\/([a-zA-Z])\//, '$1:/');

  // path.resolve() makes it absolute and folds away `..` segments.
  // Replacing backslashes with forward slashes makes comparison uniform.
  let resolved = path.resolve(s).replace(/\\/g, '/');

  // Lowercase on Windows (case-insensitive filesystem).
  if (process.platform === 'win32') {
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
// User's project files, system temp, anywhere else — not our concern.
if (!normalizedTarget.startsWith(normalizedRoot + '/') &&
    normalizedTarget !== normalizedRoot) {
  process.exit(0);
}

// ── Rule 2: inside a skill's .tmp/ → allow ──────────────────────────────────
// This is the staging area for generated artifacts (.iflw, .mmap, etc.)
// before MCP upload. Blocking it would break Phase C/D entirely.
//
// Pattern matched: <root>/skills/<any-skill>/.tmp/<anything>
// We use a regex on the path relative to the plugin root.
const relativePath = normalizedTarget.slice(normalizedRoot.length + 1);
const tmpAllowed = /^skills\/[^/]+\/\.tmp(\/|$)/.test(relativePath);
if (tmpAllowed) {
  process.exit(0);
}

// ── Rule 3: anywhere else inside the plugin → deny ──────────────────────────
// This covers SKILL.md, every references/ file (guides, phases, metadata,
// samples), tools/, bin/, scripts/, hooks/ (the hook can't disable itself),
// config/*.template, .claude-plugin/*, package.json, LICENSE, README.md,
// and the shared installed-package-rules.md file itself.
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
  'at runtime. You may write under `skills/<skill>/.tmp/` for working files\n' +
  '(generated .iflw, .mmap, scripts before MCP upload) only.\n' +
  '\n' +
  'To suggest a change to a SKILL.md, guide, metadata file, or any other\n' +
  'reference shipped with this package:\n' +
  '  1. Surface the change as a report in the Phase H completion summary\n' +
  '     under the "New Error Discoveries" block.\n' +
  '  2. Ask the user to forward it to the package maintainer by filing an\n' +
  '     issue at https://github.com/Vishal1889/ci-dev-agent/issues.\n' +
  '\n' +
  'See `skills/_shared/installed-package-rules.md` for the full rule.\n' +
  '\n'
);
process.exit(2);
