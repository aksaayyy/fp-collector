// POST /api/collect — flatten + forward FP envelope to FP Logger /collect
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
  try { body = await req.json(); } catch { body = {}; }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const ua = req.headers.get("user-agent") || "";

  // The collector wraps as {fingerprint, behavioral, challenge, link_code, meta}.
  // FP Logger /collect reads top-level keys (body.navigator, body.canvas, body.botSignals,
  // body._hp_field, body._challenge_token, body._challenge_nonce, body.meta.collectionDuration).
  // Flatten before forwarding.
  const fp = body.fingerprint || {};
  const ch = body.challenge || {};
  const flat = {
    ...fp,
    behavioral: body.behavioral,
    _hp_field: fp._hp || "",
    _challenge_token: ch.token || "",
    _challenge_nonce: ch.nonce ? String(ch.nonce) : "",
    meta: {
      ...(fp._meta || {}),
      ...(body.meta || {}),
      collectionDuration: (body.meta && body.meta.durationMs) || (fp._meta && fp._meta.collectionDurationMs) || 0,
      link_code: body.link_code || null,
      via: "vercel-proxy",
    },
  };

  // Forward FP. Pass real visitor IP via X-Forwarded-For so backend rate-limits per visitor.
  const upstream = await fetch(`${ORIGIN}/collect`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
      "user-agent": ua,
      "referer": body.meta?.referrer || "",
    },
    body: JSON.stringify(flat),
  }).catch(() => null);

  let fpId = null;
  if (upstream && upstream.ok) {
    try {
      const j = await upstream.clone().json();
      fpId = j.fingerprint_id || j.id || j.fpId || null;
    } catch {}
  }

  // Correlate click → FP
  if (body.link_code) {
    fetch(`${ORIGIN}/links/${encodeURIComponent(body.link_code)}/click`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": KEY },
      body: JSON.stringify({
        ip, user_agent: ua,
        referer: body.meta?.referrer || "",
        fingerprint_id: fpId,
      }),
    }).catch(() => {});
  }

  return new Response(JSON.stringify({
    status: upstream?.ok ? "ok" : "forward_failed",
    upstream_status: upstream?.status || 0,
    fingerprint_id: fpId,
  }), {
    status: 200, headers: { "content-type": "application/json" },
  });
}
