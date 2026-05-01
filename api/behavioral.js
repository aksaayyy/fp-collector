// POST /api/behavioral — collector behavioral beacons (currently unused by main collector,
// kept for future targeted streams or external integrations)
export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405, headers: { "content-type": "application/json" },
    });
  }
  const ORIGIN = process.env.FP_LOGGER_ORIGIN;
  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "bad body" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const ua = req.headers.get("user-agent") || "";

  const upstream = await fetch(`${ORIGIN}/collect/behavioral`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
      "user-agent": ua,
    },
    body: JSON.stringify({ ...body, _ip: ip, _via: "vercel-proxy" }),
  }).catch(() => null);

  return new Response(JSON.stringify({
    status: upstream?.ok ? "ok" : "forward_failed",
  }), {
    status: 200, headers: { "content-type": "application/json" },
  });
}
