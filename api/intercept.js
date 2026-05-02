// POST /api/intercept — anti-bot SDK hook capture (Arkose BDA, hCaptcha, reCAPTCHA, Kasada, etc.)
// Forwarded to FP Logger /api/intercept (which already exists in backend)
export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405, headers: { "content-type": "application/json" },
    });
  }
  const ORIGIN = process.env.FP_LOGGER_ORIGIN;
  const KEY = process.env.FP_LOGGER_API_KEY;
  let body;
  try { body = await req.json(); } catch { return new Response("bad body", { status: 400 }); }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const ua = req.headers.get("user-agent") || "";

  const upstream = await fetch(`${ORIGIN}/api/intercept`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": KEY,
      "x-forwarded-for": ip,
      "user-agent": ua,
    },
    body: JSON.stringify(body),
  }).catch(() => null);

  return new Response(JSON.stringify({ status: upstream?.ok ? "ok" : "forward_failed" }), {
    status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}
