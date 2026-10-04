# Security Policy · Nedamex

## Reporting a vulnerability
Please report vulnerabilities **privately** via GitHub → Security → "Report a vulnerability" (private vulnerability reporting). Do not open public issues for security problems, do not access other people's data and do not degrade the service while testing. We acknowledge reports as quickly as we can.

## Supported versions
Only the `main` branch (deployed at https://nedamex.vercel.app and https://nedamex.lovable.app) is supported.

## How Nedamex is secured
- Secrets (OpenAI, ElevenLabs, Supabase service role) only in server-side environment variables (Vercel, marked Sensitive); never committed (`.env*` git-ignored; git history scanned for key patterns before release: none found).
- Only `NEXT_PUBLIC_*` values reach the browser; the Supabase publishable key is limited by Row-Level Security on every table.
- Contact details encrypted at rest with pgcrypto; key in Supabase Vault; decrypt function executable only by `service_role` (migration 0016).
- Public write paths are SECURITY DEFINER RPCs with input validation and rate limits (`submit_proposal`, `submit_profile`, `save_extraction`).
- HTTPS everywhere (HSTS), security headers (CSP frame-ancestors, nosniff, Referrer-Policy, Permissions-Policy).
- Rate limits / flood guards on the public write RPCs; citation verifier + red-team suite for unsafe medical output.
- ElevenLabs agents: no audio recording, 30-day transcript retention.
- Dependabot version updates (`.github/dependabot.yml`) and CodeQL analysis (`.github/workflows/codeql.yml`) configured on the repository.
