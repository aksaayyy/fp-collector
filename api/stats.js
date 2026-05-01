// GET /api/stats — public landing stats (links_created, total_clicks, fingerprints_collected)
export const config = { runtime: "edge" };

export default async function handler(req) {
  const ORIGIN = process.env.FP_LOGGER_ORIGIN;
  const KEY = process.env.FP_LOGGER_API_KEY;
  const upstream = await fetch(`${ORIGIN}/links/stats`, {
    headers: { "x-api-key": KEY },
  });
  const data = await upstream.json().catch(() => ({
    status: "success", links_created: 0, total_clicks: 0, fingerprints_collected: 0, uptime: "online",
  }));
  // Strip private fields
  delete data.recent;
  return new Response(JSON.stringify(data), {
    status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
