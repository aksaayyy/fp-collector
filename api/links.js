// GET /api/links — admin list (requires X-Admin-Key matching ADMIN_API_KEYS env)
export const config = { runtime: "edge" };

export default async function handler(req) {
  const ADMIN_KEYS = (process.env.ADMIN_API_KEYS || "").split(",").map(s => s.trim()).filter(Boolean);
  const provided = req.headers.get("x-admin-key") || new URL(req.url).searchParams.get("key") || "";
  if (!ADMIN_KEYS.length || !ADMIN_KEYS.includes(provided)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { "content-type": "application/json" },
    });
  }
  const ORIGIN = process.env.FP_LOGGER_ORIGIN;
  const KEY = process.env.FP_LOGGER_API_KEY;
  const upstream = await fetch(`${ORIGIN}/links/list?limit=500`, {
    headers: { "x-api-key": KEY },
  });
  const data = await upstream.json().catch(() => ({ status: "error", links: [] }));
  return new Response(JSON.stringify(data), {
    status: upstream.ok ? 200 : 502, headers: { "content-type": "application/json" },
  });
}
