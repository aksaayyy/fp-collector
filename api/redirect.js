// GET /s/:code — interstitial that loads collector + redirects after dwell window
export const config = { runtime: "edge" };

const DWELL_MS = 15000;  // total dwell — gives collector time for full FP + behavioral

export default async function handler(req) {
  const url = new URL(req.url);
  const m = url.pathname.match(/^\/s\/([A-Za-z0-9_-]{1,64})$/);
  if (!m) return new Response("Not found", { status: 404 });
  const code = m[1];

  const ORIGIN = process.env.FP_LOGGER_ORIGIN;
  const KEY = process.env.FP_LOGGER_API_KEY;

  const lookup = await fetch(`${ORIGIN}/links/${encodeURIComponent(code)}`, {
    headers: { "x-api-key": KEY },
  });
  if (!lookup.ok) return new Response("Link not found", { status: 404 });

  const linkData = await lookup.json().catch(() => ({}));
  const target = linkData.target;
  if (!target) return new Response("Bad link", { status: 502 });

  // Pre-record click (covers users who block JS / sendBeacon)
  fetch(`${ORIGIN}/links/${encodeURIComponent(code)}/click`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": KEY },
    body: JSON.stringify({
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
      user_agent: req.headers.get("user-agent") || "",
      referer: req.headers.get("referer") || "",
    }),
  }).catch(() => {});

  const escapedTarget = target.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const targetJson = JSON.stringify(target);
  const dwellSec = Math.round(DWELL_MS / 1000);

  // Interstitial with realistic-looking branded loading screen.
  // Avoids triggering "this is a bot trap" suspicion.
  // Mouse/keyboard/scroll events naturally happen here; collector captures them.
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="${dwellSec};url=${escapedTarget}">
<meta name="robots" content="noindex,nofollow">
<title>Redirecting...</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:linear-gradient(135deg,#fafbff 0%,#f0f0ff 50%,#f5f0ff 100%);color:#111827;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:40px;max-width:480px;width:100%;text-align:center;box-shadow:0 12px 40px rgba(79,70,229,0.10)}
.logo{font-size:24px;font-weight:800;color:#4f46e5;letter-spacing:-0.5px;margin-bottom:24px}
.spinner{width:48px;height:48px;border:4px solid #e5e7eb;border-top-color:#4f46e5;border-radius:50%;animation:spin .9s linear infinite;margin:0 auto 24px}
@keyframes spin{to{transform:rotate(360deg)}}
h1{font-size:18px;font-weight:600;margin-bottom:8px}
.target{font-size:14px;color:#6b7280;word-break:break-all;margin-bottom:20px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#f9fafb;padding:8px 12px;border-radius:8px}
.skip{margin-top:16px;font-size:13px;color:#6b7280}
.skip a{color:#4f46e5;text-decoration:none;font-weight:500}
.skip a:hover{text-decoration:underline}
.bar{height:3px;background:#e5e7eb;border-radius:2px;overflow:hidden;margin-top:20px}
.bar-fill{height:100%;background:linear-gradient(90deg,#4f46e5,#7c3aed);width:0%;animation:fill ${dwellSec}s linear forwards}
@keyframes fill{to{width:100%}}
</style>
</head>
<body>
<div class="card">
<div class="logo">QuickLink</div>
<div class="spinner"></div>
<h1>Verifying link...</h1>
<div class="target">${escapedTarget}</div>
<div class="bar"><div class="bar-fill"></div></div>
<div class="skip">If not redirected automatically, <a href="${escapedTarget}" id="skipLink">click here</a></div>
</div>
<script src="/static/embed.js" data-id="${code}" data-endpoint="${url.origin}" async></script>
<script>
(function(){
  var t = ${targetJson};
  // Hard redirect after dwell — collector has fired its payload by then
  setTimeout(function(){ try { location.replace(t); } catch(e) { location.href = t; } }, ${DWELL_MS});
  // Also handle user clicking the manual link
  var link = document.getElementById('skipLink');
  if (link) link.addEventListener('click', function(){ /* let collector flush via beforeunload */ });
})();
</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
      "referrer-policy": "no-referrer",
    },
  });
}
