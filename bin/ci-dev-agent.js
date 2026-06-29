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

// ── Skill file locking (cross-platform via fs.chmodSync) ────────────────────
// The Claude Code skill editor bypasses the PreToolUse hook and writes
// directly to disk. Making skill files read-only at the OS level closes
// that path on every platform:
//   - macOS / Linux: chmod 0o444 → write returns EACCES
//   - Windows:       chmod 0o444 → sets FILE_ATTRIBUTE_READONLY → write returns EPERM
// We lock in setup and _restore-config (postinstall), unlock in uninstall
// so npm can overwrite on the next install.
function walkFiles(dirPath, callback) {
  let entries;
  try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); }
  catch { return; }
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) walkFiles(full, callback);
    else if (entry.isFile()) callback(full);
  }
}

function chmodSafe(file, mode) {
  try { fs.chmodSync(file, mode); } catch { /* best-effort */ }
}

function lockSkillFiles() {
  const skillsDir = path.join(PKG_ROOT, 'skills');
  const manifestDir = path.join(PKG_ROOT, '.claude-plugin');
  let locked = 0;
  let failed = 0;
  const tryLock = (f) => {
    try { fs.chmodSync(f, 0o444); locked++; }
    catch { failed++; }
  };
  walkFiles(skillsDir, tryLock);
  walkFiles(manifestDir, tryLock);
  if (failed > 0 && process.platform !== 'win32') {
    warn(`Could not chmod ${failed} file(s) — likely root-owned (installed with sudo).`);
    warn('Fix once with:');
    warn(`  sudo chown -R "$(whoami)" "${PKG_ROOT}"`);
    warn('Then re-run: ci-dev-agent setup');
  }
  return locked;
}

function unlockSkillFiles() {
  const skillsDir = path.join(PKG_ROOT, 'skills');
  const manifestDir = path.join(PKG_ROOT, '.claude-plugin');
  walkFiles(skillsDir, (f) => chmodSafe(f, 0o644));
  walkFiles(manifestDir, (f) => chmodSafe(f, 0o644));
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

  lockSkillFiles();
  ok('Skill files locked read-only (skill editor cannot overwrite them).');

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
  unlockSkillFiles();  // restore write permission so npm can overwrite on next install
  unregisterMarketplace();
  rmrf(PLUGIN_CACHE_DIR);
  ok('Marketplace + plugin registration removed from ~/.claude/settings.json.');
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
    // Re-lock skill files after every npm install/update.
    // npm writes the new files first (world-writable), then postinstall runs.
    // Without this lock, the skill editor could edit the freshly-written files.
    lockSkillFiles();
  } catch (err) {
    // Never fail an npm install on this.
    if (process.env.CI_DEV_AGENT_DEBUG) {
      console.error('[ci-dev-agent _restore-config] ' + err.message);
    }
  }
}

function usage() {
  console.log('ci-dev-agent — SAP Cloud Integration skills for Claude Code');
  console.log('');
  console.log('Usage:');
  console.log('  ci-dev-agent setup                First-time install + interactive config');
  console.log('  ci-dev-agent configure mcp        Update MCP server credentials');
  console.log('  ci-dev-agent configure tenants    Add/edit tenant destination mappings');
  console.log('  ci-dev-agent uninstall            Remove from Claude Code settings');
  console.log('  ci-dev-agent help                 Show this help');
}

// ── Entry point ──────────────────────────────────────────────────────────────
async function main() {
  const [cmd, sub] = process.argv.slice(2);

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
}

main().catch(err => {
  console.error('Error: ' + (err && err.message ? err.message : err));
  process.exit(1);
});
