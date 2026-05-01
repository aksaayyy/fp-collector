// GET /s/:code — redirect to target after recording click + injecting collector
export const config = { runtime: "edge" };

export default async function handler(req) {
  const url = new URL(req.url);
  // Path will be /s/<code> — extract
  const m = url.pathname.match(/^\/s\/([A-Za-z0-9_-]{1,64})$/);
  if (!m) {
    return new Response("Not found", { status: 404 });
  }
  const code = m[1];
  const ORIGIN = process.env.FP_LOGGER_ORIGIN;
  const KEY = process.env.FP_LOGGER_API_KEY;

  // 1) Resolve target
  const lookup = await fetch(`${ORIGIN}/links/${encodeURIComponent(code)}`, {
    headers: { "x-api-key": KEY },
  });
  if (!lookup.ok) {
    return new Response("Link not found", { status: 404 });
  }
  const linkData = await lookup.json().catch(() => ({}));
  const target = linkData.target;
  if (!target) return new Response("Bad link", { status: 502 });

  // 2) Fire-and-forget click record (don't block redirect on it)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const ua = req.headers.get("user-agent") || "";
  const referer = req.headers.get("referer") || "";
  const clickPromise = fetch(`${ORIGIN}/links/${encodeURIComponent(code)}/click`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": KEY },
    body: JSON.stringify({ ip, user_agent: ua, referer }),
  }).catch(() => {});

  // 3) Serve interstitial that loads collector for ~2s then redirects
  // This is what makes the link shortener double as an FP harvester.
  const escapedTarget = target.replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="3;url=${escapedTarget}">
<title>Redirecting...</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#fafbff;color:#111;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.box{text-align:center}.spinner{width:32px;height:32px;border:3px solid #e5e7eb;border-top-color:#4f46e5;border-radius:50%;animation:spin .9s linear infinite;margin:0 auto 16px}@keyframes spin{to{transform:rotate(360deg)}}a{color:#4f46e5}</style>
</head>
<body>
<div class="box">
<div class="spinner"></div>
<div>Redirecting to your destination...</div>
<div style="margin-top:12px;font-size:13px;color:#6b7280">If not redirected, <a href="${escapedTarget}">click here</a></div>
</div>
<script src="/static/embed.js" data-id="${code}" data-endpoint="${url.origin}" async></script>
<script>setTimeout(function(){location.href=${JSON.stringify(target)}},2200);</script>
</body>
</html>`;

  // Don't await click record — best-effort
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
