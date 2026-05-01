# QuickLink — URL shortener + FP collector front

Vercel Edge Functions front for FP Logger backend at fplogger.38.49.216.244.sslip.io.

## Architecture
- Public face: https://quicklinkredirect.vercel.app
- Hides origin VPS IP — all requests proxied through Vercel
- /s/:code interstitial loads embed.js collector for ~2s, then redirects
- Behavioral data forwarded to FP Logger /collect/behavioral
- Click events recorded in FP Logger SQLite (links + link_clicks tables)

## Routes
- GET /                  Landing page (URL shortener UI)
- POST /api/shorten      Create short link {url, custom_code} → {short_url, code}
- GET /s/:code           Click interstitial — loads collector then 302 to target
- GET /static/embed.js   FP collector script (snapshot + 1Hz mouse sample)
- POST /api/behavioral   Receive collector beacons → FP Logger
- GET /api/stats         Public landing stats (counts only)
- GET /api/links         Admin list (X-Admin-Key required)

## Env
- FP_LOGGER_ORIGIN     https://fplogger.38.49.216.244.sslip.io
- FP_LOGGER_API_KEY    (FP Logger backend API key)
- ADMIN_API_KEYS       Comma-separated keys for /api/links admin

## Deploy
```bash
vercel --prod
```
