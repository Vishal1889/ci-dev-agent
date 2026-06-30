#!/usr/bin/env node
/**
 * ci-dev-agent CLI
 *
 * Commands:
 *   setup              First-time install — register marketplace, configure MCP + tenants
 *   configure mcp      Re-prompt MCP credentials
 *   configure tenants  Add/edit tenant → destination mappings
 *   uninstall          Remove marketplace entry from ~/.claude/settings.json
 *   _restore-config    (internal) Postinstall hook — regenerates configs from ~/.claude/ci-dev-agent/
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// ── Paths ────────────────────────────────────────────────────────────────────
const PKG_ROOT = path.resolve(__dirname, '..');
const MCP_JSON = path.join(PKG_ROOT, 'config', 'mcp.json');
const MCP_TEMPLATE = path.join(PKG_ROOT, 'config', 'mcp.json.template');
const TENANT_CONFIG = path.join(PKG_ROOT, 'config', 'tenant-destination-config.json');
const TENANT_TEMPLATE = path.join(PKG_ROOT, 'config', 'tenant-destination-config.json.template');
const MARKETPLACE_NAME = 'ci-plugins';
const PLUGIN_KEY = 'ci-dev-agent@' + MARKETPLACE_NAME;

const CLAUDE_HOME = path.join(os.homedir(), '.claude');
const CLAUDE_SETTINGS = path.join(CLAUDE_HOME, 'settings.json');
const USER_STATE_DIR = path.join(CLAUDE_HOME, 'ci-dev-agent');
const USER_MCP_CONFIG = path.join(USER_STATE_DIR, 'mcp-config.json');
const USER_TENANT_CONFIG = path.join(USER_STATE_DIR, 'tenant-config.json');
const PLUGIN_CACHE_DIR = path.join(CLAUDE_HOME, 'plugins', 'cache', MARKETPLACE_NAME);

// Permissions to add to ~/.claude/settings.json on setup.
// (Project-level permissions already cover the rest; these are the bare minimum
//  needed for the skills to work without a permission prompt avalanche.)
const REQUIRED_PERMISSIONS = [
  'mcp__plugin_ci-dev-agent_ci-mcp-server-custom__*',
  'mcp__ide__getDiagnostics',
  'mcp__ide__executeCode',
  'Bash(mkdir *)'
];

// ── Utilities ────────────────────────────────────────────────────────────────
function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function fileExists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* ignore */ }
}

function prompt(rl, question, defaultValue) {
  const suffix = defaultValue ? ` [${defaultValue}]: ` : ': ';
  return new Promise(resolve => {
    rl.question(question + suffix, answer => {
      const trimmed = (answer || '').trim();
      resolve(trimmed || defaultValue || '');
    });
  });
}

async function promptRequired(rl, question, defaultValue) {
  while (true) {
    const v = await prompt(rl, question, defaultValue);
    if (v) return v;
    console.log('  (required — please provide a value)');
  }
}

function header(text) {
  const line = '─'.repeat(60);
  console.log('\n' + line);
  console.log(text);
  console.log(line);
}

function info(text) {
  console.log('  ' + text);
}

function ok(text) {
  console.log('  ✓ ' + text);
}

function warn(text) {
  console.log('  ! ' + text);
}

// ── Update check (zero-dep, 24h cache) ───────────────────────────────────────
// Once a day, hit the npm registry for the latest published version. Cache the
// result in `~/.claude/ci-dev-agent/.update-check.json` so we don't pound the
// registry on every CLI invocation. All failure paths fail silently — the user
// is running our CLI for a reason, we don't want to derail them with a network
// hiccup notice.
const CURRENT_VERSION = require('../package.json').version;
const UPDATE_CHECK_CACHE = path.join(USER_STATE_DIR, '.update-check.json');
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const NPM_REGISTRY_URL = 'https://registry.npmjs.org/ci-dev-agent/latest';

function compareSemver(a, b) {
  // Returns -1 if a<b, 0 if a==b, 1 if a>b. Strips pre-release suffix.
  const parse = (v) => String(v || '0').split('-')[0].split('.').map(n => parseInt(n, 10) || 0);
  const [a1, a2, a3] = parse(a);
  const [b1, b2, b3] = parse(b);
  if (a1 !== b1) return a1 < b1 ? -1 : 1;
  if (a2 !== b2) return a2 < b2 ? -1 : 1;
  if (a3 !== b3) return a3 < b3 ? -1 : 1;
  return 0;
}

function fetchLatestVersion(timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    try {
      const https = require('https');
      const req = https.get(NPM_REGISTRY_URL, { timeout: timeoutMs }, (res) => {
        if (res.statusCode !== 200) { res.resume(); done(null); return; }
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try { done(JSON.parse(data).version || null); }
          catch { done(null); }
        });
      });
      req.on('error', () => done(null));
      req.on('timeout', () => { req.destroy(); done(null); });
    } catch { done(null); }
  });
}

async function checkForUpdate({ force = false, timeoutMs = 1500 } = {}) {
  let cache = readJson(UPDATE_CHECK_CACHE, { lastCheck: 0, latest: null });
  const stale = Date.now() - (cache.lastCheck || 0) > UPDATE_CHECK_INTERVAL_MS;
  if (force || stale) {
    const latest = await fetchLatestVersion(timeoutMs);
    if (latest) {
      cache = { lastCheck: Date.now(), latest };
      try { ensureDir(USER_STATE_DIR); writeJsonAtomic(UPDATE_CHECK_CACHE, cache); }
      catch { /* cache write failure is non-fatal */ }
    }
  }
  return cache.latest;
}

function printUpdateNotice(latest) {
  if (!latest) return;
  if (compareSemver(CURRENT_VERSION, latest) >= 0) return;
  // Compose a contained box that's the same width regardless of versions.
  // On non-Windows we prefix the update command with `sudo` because the
  // default npm prefix is root-owned; users on user-owned installs (nvm,
  // Homebrew Apple Silicon, etc.) just drop the sudo. On Windows the
  // prefix is per-user, no sudo needed.
  const cmd = process.platform === 'win32'
    ? 'npm update -g ci-dev-agent'
    : 'sudo npm update -g ci-dev-agent';
  const line1 = `  ci-dev-agent ${CURRENT_VERSION} → ${latest} available`;
  const line2 = `  Run:  ${cmd}`;
  const width = Math.max(line1.length, line2.length) + 2;
  const bar = '─'.repeat(width);
  console.log('');
  console.log('┌' + bar + '┐');
  console.log('│' + line1.padEnd(width) + '│');
  console.log('│' + line2.padEnd(width) + '│');
  console.log('└' + bar + '┘');
}

// Convenience: run the (cached) check + print notice. Never throws.
async function maybeNotifyUpdate() {
  try {
    const latest = await checkForUpdate();
    printUpdateNotice(latest);
  } catch { /* silent */ }
}

// ── Settings.json management ─────────────────────────────────────────────────
function loadGlobalSettings() {
  ensureDir(CLAUDE_HOME);
  if (!fileExists(CLAUDE_SETTINGS)) {
    writeJsonAtomic(CLAUDE_SETTINGS, {});
  }
  return readJson(CLAUDE_SETTINGS, {});
}

function saveGlobalSettings(settings) {
  writeJsonAtomic(CLAUDE_SETTINGS, settings);
}

function registerMarketplace() {
  const settings = loadGlobalSettings();

  if (!settings.extraKnownMarketplaces) settings.extraKnownMarketplaces = {};
  settings.extraKnownMarketplaces[MARKETPLACE_NAME] = {
    source: { source: 'directory', path: PKG_ROOT }
  };

  if (!settings.enabledPlugins) settings.enabledPlugins = {};
  settings.enabledPlugins[PLUGIN_KEY] = true;

  if (!settings.permissions) settings.permissions = {};
  if (!Array.isArray(settings.permissions.allow)) settings.permissions.allow = [];
  for (const perm of REQUIRED_PERMISSIONS) {
    if (!settings.permissions.allow.includes(perm)) {
      settings.permissions.allow.push(perm);
    }
  }

  saveGlobalSettings(settings);
}

function unregisterMarketplace() {
  if (!fileExists(CLAUDE_SETTINGS)) return;
  const settings = readJson(CLAUDE_SETTINGS, {});

  if (settings.extraKnownMarketplaces && settings.extraKnownMarketplaces[MARKETPLACE_NAME]) {
    delete settings.extraKnownMarketplaces[MARKETPLACE_NAME];
  }
  if (settings.enabledPlugins && settings.enabledPlugins[PLUGIN_KEY] !== undefined) {
    delete settings.enabledPlugins[PLUGIN_KEY];
  }
  if (settings.permissions && Array.isArray(settings.permissions.allow)) {
    settings.permissions.allow = settings.permissions.allow.filter(
      p => !REQUIRED_PERMISSIONS.includes(p)
    );
  }

  saveGlobalSettings(settings);
}

// ── Hook registration (user-scope, not plugin-scope) ─────────────────────────
// Plugin-scope hooks declared via plugin.json work on Windows but fail to
// load on macOS (verified empirically). User-scope hooks in
// ~/.claude/settings.json work everywhere, so that's where we register the
// deny-self-edit hook. The hook script self-detects the plugin root from
// `__dirname`, so we don't need to set CLAUDE_PLUGIN_ROOT inline.
const HOOK_SCRIPT_REL = path.join('hooks', 'deny-self-edit.js');
const HOOK_MATCHER = 'Edit|Write|NotebookEdit';

function buildHookCommand() {
  // node + absolute path to our hook script. JSON.stringify gives us a quoted
  // form that handles paths with spaces. Works on Windows, macOS, and Linux.
  const scriptAbs = path.join(PKG_ROOT, HOOK_SCRIPT_REL);
  return `node ${JSON.stringify(scriptAbs)}`;
}

function isOurHook(hookEntry) {
  // Match by the unique script filename so we find our entries regardless
  // of which prefix npm installed under, what version, or whether the user
  // hand-edited the command (e.g. added an env-var prefix).
  return typeof hookEntry?.command === 'string'
    && hookEntry.command.includes('deny-self-edit.js');
}

function registerHook() {
  const settings = loadGlobalSettings();

  if (!settings.hooks) settings.hooks = {};
  if (!Array.isArray(settings.hooks.PreToolUse)) settings.hooks.PreToolUse = [];

  // Remove any existing deny-self-edit entries first — they may point at a
  // stale path (different npm prefix, older plugin version, manual setup).
  // Filtering at both the matcher level (inner `hooks` array) and the entry
  // level (outer PreToolUse array) cleans up entries left empty after the
  // filter.
  settings.hooks.PreToolUse = settings.hooks.PreToolUse
    .map(entry => ({
      ...entry,
      hooks: Array.isArray(entry.hooks) ? entry.hooks.filter(h => !isOurHook(h)) : entry.hooks
    }))
    .filter(entry => !Array.isArray(entry.hooks) || entry.hooks.length > 0);

  // Add the fresh entry pointing at this install's hook script.
  settings.hooks.PreToolUse.push({
    matcher: HOOK_MATCHER,
    hooks: [{ type: 'command', command: buildHookCommand() }]
  });

  saveGlobalSettings(settings);
}

function unregisterHook() {
  if (!fileExists(CLAUDE_SETTINGS)) return;
  const settings = readJson(CLAUDE_SETTINGS, {});
  if (!settings.hooks || !Array.isArray(settings.hooks.PreToolUse)) return;

  settings.hooks.PreToolUse = settings.hooks.PreToolUse
    .map(entry => ({
      ...entry,
      hooks: Array.isArray(entry.hooks) ? entry.hooks.filter(h => !isOurHook(h)) : entry.hooks
    }))
    .filter(entry => !Array.isArray(entry.hooks) || entry.hooks.length > 0);

  // If PreToolUse is now empty, remove the key entirely (and hooks if it has
  // no other events) so settings.json stays tidy.
  if (settings.hooks.PreToolUse.length === 0) delete settings.hooks.PreToolUse;
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

  saveGlobalSettings(settings);
}

// ── MCP config ───────────────────────────────────────────────────────────────
function buildMcpJson(creds) {
  // Read template (or fall back to a minimal default) and merge user creds.
  let tpl;
  try {
    tpl = readJson(MCP_TEMPLATE);
  } catch {
    tpl = { mcpServers: { 'ci-mcp-server-custom': { type: 'http', oauth: { callbackPort: 8080 } } } };
  }
  const srv = tpl.mcpServers['ci-mcp-server-custom'];
  srv.url = creds.url;
  srv.oauth = srv.oauth || {};
  srv.oauth.clientId = creds.clientId;
  srv.oauth.authorizeUrl = creds.authorizeUrl;
  srv.oauth.tokenUrl = creds.tokenUrl;
  if (srv.oauth.callbackPort == null) srv.oauth.callbackPort = 8080;
  return tpl;
}

async function configureMcp(rl, existing) {
  header('MCP server configuration');
  info('Find these values in your SAP BTP subaccount service key.');
  console.log('');

  const url = await promptRequired(rl,
    '  MCP server URL (e.g. https://my-app.cfapps.us10.hana.ondemand.com/mcp)',
    existing && existing.url);
  const clientId = await promptRequired(rl,
    '  OAuth client ID',
    existing && existing.clientId);
  const authorizeUrl = await promptRequired(rl,
    '  OAuth authorize URL (e.g. https://tenant.authentication.us10.hana.ondemand.com/oauth/authorize)',
    existing && existing.authorizeUrl);
  const tokenUrl = await promptRequired(rl,
    '  OAuth token URL (e.g. https://tenant.authentication.us10.hana.ondemand.com/oauth/token)',
    existing && existing.tokenUrl);

  const creds = { url, clientId, authorizeUrl, tokenUrl };

  // Save canonical copy (survives npm update)
  ensureDir(USER_STATE_DIR);
  writeJsonAtomic(USER_MCP_CONFIG, creds);

  // Materialize into plugin directory
  writeJsonAtomic(MCP_JSON, buildMcpJson(creds));

  ok('MCP config saved.');
}

// ── Tenant config ────────────────────────────────────────────────────────────
function loadTenantConfig() {
  if (fileExists(USER_TENANT_CONFIG)) return readJson(USER_TENANT_CONFIG, {});
  if (fileExists(TENANT_CONFIG)) return readJson(TENANT_CONFIG, {});
  if (fileExists(TENANT_TEMPLATE)) return readJson(TENANT_TEMPLATE, {});
  return {};
}

function saveTenantConfig(tenants) {
  ensureDir(USER_STATE_DIR);
  writeJsonAtomic(USER_TENANT_CONFIG, tenants);
  writeJsonAtomic(TENANT_CONFIG, tenants);
}

function printTenants(tenants) {
  const names = Object.keys(tenants);
  if (!names.length) {
    info('(no tenants configured yet)');
    return;
  }
  for (const name of names) {
    const t = tenants[name];
    console.log(`    - ${name}: designTime=${t.designTime}, runtime=${t.runtime}`);
  }
}

async function configureTenants(rl) {
  header('Tenant → destination configuration');
  info('Map each tenant/environment to its CPI design-time and runtime destination names.');
  info('These match the destinations defined in your BTP subaccount.');
  console.log('');

  let tenants = loadTenantConfig();
  info('Current tenants:');
  printTenants(tenants);
  console.log('');

  while (true) {
    const action = (await prompt(rl,
      '  Action — [a]dd, [e]dit, [r]emove, [d]one',
      'd')).toLowerCase();

    if (action === 'd' || action === '') break;

    if (action === 'a' || action === 'e') {
      const name = await promptRequired(rl, '  Tenant name (e.g. Trial, PROD)');
      const existing = tenants[name] || {};
      const designTime = await promptRequired(rl,
        '  Design-time destination name', existing.designTime);
      const runtime = await promptRequired(rl,
        '  Runtime destination name', existing.runtime);
      tenants[name] = { designTime, runtime };
      ok(`Saved tenant "${name}".`);
    } else if (action === 'r') {
      const name = await prompt(rl, '  Tenant name to remove');
      if (name && tenants[name]) {
        delete tenants[name];
        ok(`Removed tenant "${name}".`);
      } else {
        warn(`Tenant "${name}" not found.`);
      }
    } else {
      warn('Unknown action.');
      continue;
    }

    console.log('');
    info('Current tenants:');
    printTenants(tenants);
    console.log('');
  }

  saveTenantConfig(tenants);
  ok('Tenant config saved.');
}

// ── Commands ─────────────────────────────────────────────────────────────────
async function cmdSetup() {
  console.log('ci-dev-agent installer');
  console.log('Package root: ' + PKG_ROOT);
  console.log('');

  header('Register marketplace');
  registerMarketplace();
  ok(`Marketplace "${MARKETPLACE_NAME}" registered.`);
  ok(`Plugin "${PLUGIN_KEY}" enabled.`);

  rmrf(PLUGIN_CACHE_DIR);
  ok('Plugin cache cleared.');

  registerHook();
  ok('PreToolUse deny-self-edit hook registered (blocks edits to plugin files).');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    // MCP — only prompt if not already configured (and no saved canonical copy)
    if (fileExists(USER_MCP_CONFIG)) {
      header('MCP server configuration');
      info('Existing MCP config found at ~/.claude/ci-dev-agent/mcp-config.json — regenerating config/mcp.json.');
      const saved = readJson(USER_MCP_CONFIG);
      writeJsonAtomic(MCP_JSON, buildMcpJson(saved));
      ok('MCP config restored.');
      const change = (await prompt(rl, '  Change MCP credentials now? [y/N]', 'N')).toLowerCase();
      if (change === 'y' || change === 'yes') {
        await configureMcp(rl, saved);
      }
    } else {
      await configureMcp(rl);
    }

    // Tenants
    const change = (await prompt(rl, '\n  Configure tenant destinations now? [Y/n]', 'Y')).toLowerCase();
    if (change !== 'n' && change !== 'no') {
      await configureTenants(rl);
    }
  } finally {
    rl.close();
  }

  header('Setup complete');
  console.log('');
  console.log('  Restart Claude Code to load the plugin.');
  console.log('');
  console.log('  Skills available:');
  console.log('    /ci-iflow-developer   — Integration Flow development');
  console.log('    /ci-sa-mm-developer   — Standalone Message Mapping');
  console.log('    /ci-sa-sc-developer   — Standalone Script Collection');
  console.log('');
  console.log('  Re-run anytime:');
  console.log('    ci-dev-agent configure mcp');
  console.log('    ci-dev-agent configure tenants');
  console.log('');
}

async function cmdConfigure(target) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    if (target === 'mcp') {
      const saved = fileExists(USER_MCP_CONFIG) ? readJson(USER_MCP_CONFIG) : null;
      await configureMcp(rl, saved);
    } else if (target === 'tenants') {
      await configureTenants(rl);
    } else {
      console.log('Usage: ci-dev-agent configure <mcp|tenants>');
      process.exit(1);
    }
  } finally {
    rl.close();
  }
  console.log('');
  info('Restart Claude Code for changes to take effect.');
}

function cmdUninstall() {
  console.log('ci-dev-agent uninstaller');
  unregisterHook();
  unregisterMarketplace();
  rmrf(PLUGIN_CACHE_DIR);
  ok('Marketplace + plugin + hook registration removed from ~/.claude/settings.json.');
  console.log('');
  info('Your saved config in ~/.claude/ci-dev-agent/ was preserved.');
  info('Delete it manually if you want a clean slate:');
  info('  ' + USER_STATE_DIR);
  info('  (macOS/Linux: rm -rf <path>   Windows: rmdir /s /q <path>)');
  console.log('');
  info('To fully remove the package: npm uninstall -g ci-dev-agent');
}

function cmdRestoreConfig() {
  // Non-interactive: silent if first install (no saved config yet).
  // Used by npm postinstall hook to survive `npm update`.
  try {
    if (fileExists(USER_MCP_CONFIG)) {
      const saved = readJson(USER_MCP_CONFIG);
      writeJsonAtomic(MCP_JSON, buildMcpJson(saved));
    }
    if (fileExists(USER_TENANT_CONFIG)) {
      const tenants = readJson(USER_TENANT_CONFIG);
      writeJsonAtomic(TENANT_CONFIG, tenants);
    }
    // Re-register the deny-self-edit hook with the freshly-installed path.
    // npm install/update writes new files to a new path (especially when the
    // version is part of the cache layout). Without this, the hook command
    // in settings.json would point at the previous version's hook script.
    // Skipped silently if ~/.claude/settings.json doesn't exist yet (the
    // user hasn't run `ci-dev-agent setup` yet — they will, and setup also
    // registers the hook).
    if (fileExists(CLAUDE_SETTINGS)) registerHook();
  } catch (err) {
    // Never fail an npm install on this.
    if (process.env.CI_DEV_AGENT_DEBUG) {
      console.error('[ci-dev-agent _restore-config] ' + err.message);
    }
  }
}

async function cmdVersion() {
  console.log(`ci-dev-agent ${CURRENT_VERSION}`);
  console.log(`Node ${process.version}  (${process.platform}-${process.arch})`);
  console.log('');
  console.log('Checking npm registry for newer version…');
  // Force a fresh check (bypass the 24h cache) so the version command always
  // gives an authoritative answer.
  const latest = await checkForUpdate({ force: true, timeoutMs: 3000 });
  if (!latest) {
    console.log('  (no response from registry — try again later)');
    return;
  }
  const cmp = compareSemver(CURRENT_VERSION, latest);
  if (cmp >= 0) {
    ok(`You're on the latest version (${latest}).`);
  } else {
    printUpdateNotice(latest);
  }
}

async function cmdUpgrade({ force = false } = {}) {
  console.log(`ci-dev-agent ${CURRENT_VERSION}`);
  console.log('');
  console.log('Checking npm registry for newer version…');
  const latest = await checkForUpdate({ force: true, timeoutMs: 3000 });

  if (!latest) {
    warn('Could not reach the npm registry. Check your network and try again.');
    process.exit(1);
  }

  const cmp = compareSemver(CURRENT_VERSION, latest);
  if (cmp >= 0 && !force) {
    ok(`You're on the latest version (${latest}). No upgrade needed.`);
    info('Force-reinstall the same version with: ci-dev-agent upgrade --force');
    return;
  }

  // Show what we're about to do.
  console.log('');
  if (cmp < 0) {
    header(`Upgrade plan — ${CURRENT_VERSION} → ${latest}`);
  } else {
    header(`Reinstall plan — ${CURRENT_VERSION} (forced)`);
  }
  console.log('');
  info('Your MCP credentials and tenant config in ~/.claude/ci-dev-agent/');
  info('are preserved automatically. The PreToolUse deny-self-edit hook in');
  info('~/.claude/settings.json is re-registered by the postinstall step so');
  info('it points at the new install path.');
  console.log('');
  if (process.platform === 'win32') {
    console.log('Run:');
    console.log('');
    console.log('  npm update -g ci-dev-agent');
  } else {
    console.log('Run (on managed Macs: activate elevated privileges first, then run under sudo):');
    console.log('');
    console.log('  sudo npm update -g ci-dev-agent');
    console.log('');
    info('On user-owned Node installs (nvm/volta/fnm/asdf/Homebrew Apple');
    info('Silicon), drop the sudo: `npm update -g ci-dev-agent`.');
  }
  console.log('');
  info('After the install finishes, restart Claude Code.');
}

function usage() {
  console.log('ci-dev-agent — SAP Cloud Integration skills for Claude Code');
  console.log('');
  console.log('Usage:');
  console.log('  ci-dev-agent setup                First-time install + interactive config');
  console.log('  ci-dev-agent configure mcp        Update MCP server credentials');
  console.log('  ci-dev-agent configure tenants    Add/edit tenant destination mappings');
  console.log('  ci-dev-agent version              Show installed version + check for updates');
  console.log('  ci-dev-agent upgrade [--force]    Show the upgrade command for the latest version');
  console.log('  ci-dev-agent uninstall            Remove from Claude Code settings');
  console.log('  ci-dev-agent help                 Show this help');
}

// ── Entry point ──────────────────────────────────────────────────────────────
async function main() {
  const [cmd, sub] = process.argv.slice(2);

  // Commands that handle their own update reporting (`version`, `upgrade`) or
  // that run inside an `npm install` lifecycle hook (`_restore-config`, must
  // stay silent or it pollutes npm's install output) skip the trailing notice.
  const skipUpdateNotice = new Set(['version', '--version', '-v', 'upgrade', '_restore-config']);

  switch (cmd) {
    case 'setup':
      await cmdSetup();
      break;
    case 'configure':
      await cmdConfigure(sub);
      break;
    case 'uninstall':
      cmdUninstall();
      break;
    case 'version':
    case '--version':
    case '-v':
      await cmdVersion();
      break;
    case 'upgrade':
      await cmdUpgrade({ force: process.argv.includes('--force') });
      break;
    case '_restore-config':
      cmdRestoreConfig();
      break;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      usage();
      break;
    default:
      console.error('Unknown command: ' + cmd);
      console.error('');
      usage();
      process.exit(1);
  }

  if (!skipUpdateNotice.has(cmd)) {
    await maybeNotifyUpdate();
  }
}

main().catch(err => {
  console.error('Error: ' + (err && err.message ? err.message : err));
  process.exit(1);
});
