# Installed package rules — applies to ALL ci-dev-agent skills

This skill is shipped as part of the **`ci-dev-agent` npm package** installed at
`<npm-prefix>/lib/node_modules/ci-dev-agent/` (or the Windows equivalent under
`%APPDATA%\npm\node_modules\ci-dev-agent\`). The package's `skills/` tree —
along with every other file that ships in the npm tarball — is **immutable at
runtime**.

## Hard prohibitions — Edit/Write inside the plugin

Under **NO circumstances** call `Edit`, `Write`, or `NotebookEdit` against any
file shipped with the npm package. **Everything inside the installed plugin
directory is read-only — no exceptions.** This includes, but is NOT limited to,
all of:

- `SKILL.md` files (any skill, any version)
- **All reference files shipped with the package**:
  - `skills/**/references/guides/**` — `known-errors.md`, design-guidelines, scripting-guidelines, all of it
  - `skills/**/references/phases/**` — `phase-a`, `phase-b`, `phase-c`, `phase-d`, `phase-e`, `phase-fgh`, all of it
  - `skills/**/references/metadata/**` — adapter and step JSON schemas
  - `skills/**/references/minimal-iflows/**` — `.iflw` / `.prop` / `.propdef` reference samples
  - `skills/**/references/minimal-message-mappings/**` — `.mmap` reference samples
  - `skills/**/references/sample-*/**` — sample project trees (script collection, standalone mapping)
- `skills/**/tools/**` — bundled scripts like `distill-metadata.py`
- `.claude-plugin/marketplace.json` and `.claude-plugin/plugin.json`
- `config/*.template` — the templates the CLI copies from
- `bin/**`, `scripts/**`, `hooks/**` — the CLI and hook scripts themselves
- `package.json`, `LICENSE`, `README.md`
- `skills/_shared/installed-package-rules.md` — this very file

These are all part of the published npm tarball. Editing them does nothing
useful: the changes affect only your local copy, vanish on `npm update`, and
never reach the maintainer or other users. The same rule applies whether the
file is `.md`, `.json`, `.js`, `.py`, `.iflw`, `.mmap`, `.xsd`, or anything
else — **shipped-with-package = read-only**.

This applies whether the session is in plan mode, Auto mode, or interactive
mode. It applies whether the user typed *"improve the skill"*, *"fix this in
known-errors.md"*, *"update the adapter metadata"*, or anything similar — the
answer is always: surface the change as a report in **Phase H** (for iFlow
work) or in the equivalent completion summary (for the other skills) and ask
the user to file an issue at
https://github.com/Vishal1889/ci-dev-agent/issues. A `PreToolUse` hook also
blocks these writes at the harness level; this prose is the first line of
defense.

## What you CAN write to

- **`<cwd>/.ci-dev-agent/runs/<artifact-id>/`** — the per-run working directory,
  inside the user's **current project directory** (`<cwd>` = wherever the user
  opened Claude Code). The skill writes generated `.iflw`, `.mmap`, Groovy/JS
  scripts, `parameters.prop` / `parameters.propdef`, MANIFEST.MF, XSDs — the
  full unpacked iFlow ZIP layout — here before uploading via MCP. On first
  creation of `<cwd>/.ci-dev-agent/`, drop a self-ignoring `.gitignore`
  containing `*` (idempotent) so the directory tree stays out of git. This
  location survives `npm update` (it's not under the plugin install) and is
  per-project (two iFlow generations in different project directories cannot
  collide).
- The user's project directory in general — generated artifacts, scripts,
  output files, documentation, anything the user asked you to produce in their
  own workspace.
- `~/.claude/ci-dev-agent/` — user-specific config (canonical MCP and tenant
  configs). This is managed by the `ci-dev-agent` CLI only — do not write here
  from inside a skill.

The `PreToolUse` hook in this plugin enforces this split: any write inside the
plugin install directory is denied unconditionally. Writes outside the plugin
(the user's `<cwd>`, home directory, etc.) are allowed. If you attempt a denied
write, the hook returns a non-zero exit code with a stderr message reminding
you to use `<cwd>/.ci-dev-agent/runs/<artifact-id>/` for working files or
surface skill-improvement requests as a Phase H report.
