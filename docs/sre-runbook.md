# ROW K SRE Runbook

## Health Checks

- Monitor `/api/health` from outside Vercel every 1-5 minutes.
- Alert if it fails twice in a row or returns a non-2xx status.

## Alerts

- Repeated 5xx responses on `/api/*`.
- Spikes in 401/429 on `/api/admin/login`.
- Failures from GitHub-backed JSON saves.
- OpenAI extraction failures or timeouts.
- High request volume on `/api/admin/stylists/booking-preview`, `/api/admin/stylists/checks`, `/api/admin/discovery/generate`, or `/api/search`.

## Logging

Log route, method, status, duration, request id, and coarse error category. Do not log passwords, API tokens, cookies, authorization headers, or full scraped page text.

## Backup And Restore

The source of truth is JSON in `data/*.json`, with hosted writes backed by GitHub commits. To roll back a bad data change, restore the affected JSON file from git history and redeploy or commit the restored file back to the configured branch.

## Secret Rotation

Rotate `ADMIN_PASSWORD`, `GITHUB_TOKEN`, `OPENAI_API_KEY`, and `EXA_API_KEY` after any suspected exposure. Use least-privileged tokens where the provider supports scoped access.
