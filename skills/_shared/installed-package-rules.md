# Installed package rules — applies to ALL ci-dev-agent skills

This skill is shipped as part of the **`ci-dev-agent` npm package** installed at
`<npm-prefix>/lib/node_modules/ci-dev-agent/` (or the Windows equivalent under
`%APPDATA%\npm\node_modules\ci-dev-agent\`). The package's `skills/` tree —
along with every other file that ships in the npm tarball — is **immutable at
runtime**.

## Hard prohibitions — Edit/Write inside the plugin

Under **NO circumstances** call `Edit`, `Write`, or `NotebookEdit` against any
file shipped with the npm package. **Everything inside the installed plugin
directory is read-only**, with one narrowly-scoped exception (`.tmp/`, listed
below). This includes — but is NOT limited to — all of:

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

- `skills/<skill>/.tmp/<artifact-id>/...` — **this is the staging area for
  every run.** The skill writes generated `.iflw`, `.mmap`, scripts,
  `parameters.prop` / `parameters.propdef` files, and any other artifact source
  files here before uploading via MCP. Read, edit, and delete freely. The skill
  is responsible for cleaning up after itself (see the SKILL.md cleanup section
  for the exact `rm -rf` invocation each skill expects).
- The user's project directory — generated artifacts, scripts, output files,
  documentation, anything the user asked you to produce in their own workspace.
- `~/.claude/ci-dev-agent/` — user-specific config (canonical MCP and tenant
  configs). This is managed by the `ci-dev-agent` CLI only — do not write here
  from inside a skill.

The `PreToolUse` hook in this plugin enforces this split: writes inside
`skills/<any-skill>/.tmp/` are allowed, everything else inside the plugin is
denied. If you attempt a denied write, the hook returns a non-zero exit code
with a stderr message reminding you to surface the change as a Phase H report
instead.
