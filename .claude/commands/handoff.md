---
description: Write a lane hand-off note to docs/handoffs/<date>-<lane>.md covering what's done, what was verified, what's blocked and what's next
argument-hint: "<lane: data|app|landing|voice|video|release|workflow> [notes]"
allowed-tools: Bash(git status *), Bash(git diff *), Bash(git log *), Bash(git branch *), Bash(date *), Write, Edit
---

## Context
- Now (UTC): !`date -u "+%F %H:%M"` → convert to CDMX (UTC−6, no DST)
- Branch: !`git branch --show-current`
- Status: !`git status --short`
- Commits: !`git log --oneline -10`
- Diff: !`git diff --stat`

## Write `docs/handoffs/<YYYY-MM-DD-HHMM>-<lane>.md`
Lane = `$0`, or inferred from `feat/<lane>`. Extra notes: `$ARGUMENTS`. Create the folder if missing.
Use **only facts** from git, this session and the user's notes. Never invent status, URLs or results. Write "unknown" instead.

```markdown
# Hand-off · <lane> · <YYYY-MM-DD HH:MM CDMX>
| Branch | Last commit | PR | Preview |
|---|---|---|---|
|  |  |  |  |

## Done
-
## Verified (command → result)
-
## Open / blocked (owner)
-
## Next 3 steps (for whoever picks this up)
1.
## Needs from other lanes
-
## Placeholders still visible (UI / docs / video)
-
```

Then print the file path and a **3-line summary** ready to paste in the team chat.
