---
description: Run the evidence-auditor QA suite (verifier tests, graph integrity SQL, EN/ES red-team against /api/ask, secret scan)
argument-hint: "[base-url, default: local dev on :3100]"
---

Use the **evidence-auditor** subagent to run its full checklist.

- Target: `$ARGUMENTS`. If empty, start `NEXT_DIST_DIR=.next-qa npm run dev -- -p 3100` in the background, use `http://localhost:3100`, and stop the server when done.
- Kit: `.claude/qa/integrity.sql` (Supabase MCP `execute_sql`) · `node .claude/qa/redteam.mjs <base-url>`.
- If the target runs in demo mode (no `OPENAI_API_KEY`), say so and recommend rerunning against the preview or production URL.

Return the auditor's QA table verbatim, then one line: **SHIP** or **DO NOT SHIP**, plus the owner of each blocking finding.
