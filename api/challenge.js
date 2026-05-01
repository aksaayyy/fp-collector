// GET /api/challenge — proxy to FP Logger /challenge (collector PoW challenge)
export const config = { runtime: "edge" };

export default async function handler(req) {
  const ORIGIN = process.env.FP_LOGGER_ORIGIN;
  const upstream = await fetch(`${ORIGIN}/challenge`).catch(() => null);
  if (!upstream) {
    return new Response(JSON.stringify({ token: "", difficulty: 0 }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  }
  const data = await upstream.text();
  return new Response(data, {
    status: upstream.status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
