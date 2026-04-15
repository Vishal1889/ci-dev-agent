const fs = require('fs');
const path = require('path');

const PORT = 3847;
const CONFIG_FILENAME = 'ci-dev-plugin.local.md';

/**
 * Resolve the project directory.
 * Uses CLAUDE_PROJECT_DIR env var if available, otherwise walks up from cwd
 * looking for a .claude directory.
 */
function getProjectDir() {
  if (process.env.CLAUDE_PROJECT_DIR) {
    return process.env.CLAUDE_PROJECT_DIR;
  }
  // Fallback: walk up from cwd looking for .claude/
  let dir = process.cwd();
  while (true) {
    if (fs.existsSync(path.join(dir, '.claude'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

/**
 * Read the plugin config file and check if the orchestration dashboard is enabled.
 * Returns true only if .claude/ci-dev-plugin.local.md exists and contains
 * orchestration_dashboard: true in its YAML frontmatter.
 */
function isEnabled() {
  try {
    const projectDir = getProjectDir();
    const configPath = path.join(projectDir, '.claude', CONFIG_FILENAME);

    if (!fs.existsSync(configPath)) {
      return false;
    }

    const content = fs.readFileSync(configPath, 'utf-8');

    // Extract YAML frontmatter between --- markers
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) {
      return false;
    }

    const frontmatter = match[1];

    // Check for orchestration_dashboard: true
    const dashboardMatch = frontmatter.match(/^\s*orchestration_dashboard\s*:\s*(.+)\s*$/m);
    if (!dashboardMatch) {
      return false;
    }

    const value = dashboardMatch[1].trim().toLowerCase();
    return value === 'true';
  } catch {
    return false;
  }
}

module.exports = { isEnabled, PORT, getProjectDir };
