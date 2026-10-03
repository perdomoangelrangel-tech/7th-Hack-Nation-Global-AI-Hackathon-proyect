---
description: Verify (typecheck · lint · test · build), then commit, push, open or update the PR and report the Vercel preview URL
argument-hint: "[commit message]"
allowed-tools: Bash(npm run *), Bash(npm --prefix video run *), Bash(git status *), Bash(git diff *), Bash(git log *), Bash(git branch *), Bash(git rev-parse *), Bash(git add *), Bash(git commit *), Bash(git push *), Bash(gh pr *), mcp__vercel__list_*, mcp__vercel__get_deployment*, mcp__github
disable-model-invocation: true
---

## Context
- Branch: !`git branch --show-current`
- Status: !`git status --short`
- Recent: !`git log --oneline -5`

## Steps (stop at the first ✗ and show the error excerpt)
1. **Guard:** if the branch is `main`, stop and suggest `git switch -c feat/<lane>`.
2. **Scope:** compare the changed files with the lane table in `CLAUDE.md`. List out-of-lane files and ask before including them. Never stage `.env*`, `.next*`, `node_modules`, `video/out`.
3. **Secrets:** `git diff` and `git diff --cached` must not contain `sb_secret_`, `service_role`, `sk-…`, `SUPABASE_SERVICE_ROLE_KEY=` or any other key value. If they do, stop.
4. **Verify:**
   - `npm run typecheck` → `npm run lint` → `npm test` → `NEXT_DIST_DIR=.next-ship npm run build`
   - if `video/**` changed: `npm --prefix video run typecheck`
   - if answers, verifier, agents or the API changed: tell the user to run `/qa` before merging.
5. **Commit:** `git add <explicit paths>` (never `-A`). Message = `$ARGUMENTS`, or a conventional one like `feat(<lane>): <what>`.
6. **Push:** `git push -u origin HEAD`.
7. **PR:** `gh pr view --json url,number`. If there is none, `gh pr create --base main --fill`. Use the GitHub MCP if `gh` is missing.
8. **Preview:** with the Vercel MCP (team `perdomoangelrangel-techs-projects`), find the deployment for this commit SHA. Poll until READY or ERROR (≤ 5 min). On ERROR, summarize the build log.

## Report
| Check | Result |
|---|---|
| typecheck · lint · test · build | ✓/✗ |
| commit | `<sha>` `<message>` |
| PR | <url> |
| Preview | <url> (READY/ERROR) |
| Next | /qa · request review · squash-merge |
