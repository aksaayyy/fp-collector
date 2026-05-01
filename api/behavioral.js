// POST /api/behavioral — receive collector beacons, forward to FP Logger backend
export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405, headers: { "content-type": "application/json" },
    });
  }
  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "bad body" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  if (!body.fingerprintId || !body.eventType) {
    return new Response(JSON.stringify({ detail: [
      ...(body.fingerprintId ? [] : [{ type:"missing", loc:["body","fingerprintId"], msg:"Field required", input:body }]),
      ...(body.eventType ? [] : [{ type:"missing", loc:["body","eventType"], msg:"Field required", input:body }]),
      ...(body.data ? [] : [{ type:"missing", loc:["body","data"], msg:"Field required", input:body }]),
    ]}), { status: 422, headers: { "content-type": "application/json" } });
  }

  const ORIGIN = process.env.FP_LOGGER_ORIGIN;
  const KEY = process.env.FP_LOGGER_API_KEY;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";

  // Forward to FP Logger /collect/behavioral (which is public for collector ingress)
  // Also record click correlation if eventType === 'pageview'
  if (body.eventType === "pageview" && body.fingerprintId) {
    fetch(`${ORIGIN}/links/${encodeURIComponent(body.fingerprintId)}/click`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": KEY },
      body: JSON.stringify({
        ip,
        user_agent: req.headers.get("user-agent") || "",
        referer: body.data?.referrer || "",
        fingerprint_id: body.fingerprintId,
      }),
    }).catch(() => {});
  }

  const upstream = await fetch(`${ORIGIN}/collect/behavioral`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fingerprintId: body.fingerprintId,
      eventType: body.eventType,
      data: { ...body.data, _ip: ip, _via: "vercel-proxy" },
    }),
  }).catch(() => null);

  return new Response(JSON.stringify({ status: "ok", forwarded: !!(upstream && upstream.ok) }), {
    status: 200, headers: { "content-type": "application/json" },
  });
}
