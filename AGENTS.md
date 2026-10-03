<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Nedamex · rules for every coding agent (Claude Code, Codex, Cursor, Lovable)

- Source of truth: `CLAUDE.md` (non-negotiables, lane ownership, verification) and `docs/WORKFLOW.md` (lanes, timeline, worktrees).
- No claim without an `evidence_id`; never invent data, IDs or people; "not medical advice" on every answer.
- No secrets client-side; Supabase service role only on server/edge. Never read or commit `.env*`.
- Edit only the paths your lane owns; ask other owners via a hand-off note in `docs/handoffs/`.
- Done = `npm run typecheck && npm run lint && npm test && npm run build` green.
