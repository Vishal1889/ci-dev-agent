#!/usr/bin/env node
/**
 * sync-plugin-version.js — keep .claude-plugin/plugin.json in lockstep with package.json.
 *
 * Run via the `version` lifecycle hook in package.json — npm sets the new version on
 * package.json BEFORE invoking this script, so we just mirror it into plugin.json.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const pkg = require(path.resolve(__dirname, '..', 'package.json'));
const pluginFile = path.resolve(__dirname, '..', '.claude-plugin', 'plugin.json');
const plugin = JSON.parse(fs.readFileSync(pluginFile, 'utf8'));

if (plugin.version === pkg.version) {
  process.exit(0);
}

plugin.version = pkg.version;
fs.writeFileSync(pluginFile, JSON.stringify(plugin, null, 2) + '\n');
console.log(`Synced plugin.json version to ${pkg.version}`);
