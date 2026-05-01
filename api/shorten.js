// POST /api/shorten — create short link
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
  if (!body.url || typeof body.url !== "string") {
    return new Response(JSON.stringify({ error: "url required", status: "error" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  const publicBase = new URL(req.url).origin;
  const upstream = await fetch(`${ORIGIN}/links/create`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": KEY,
      "x-public-base": publicBase,
    },
    body: JSON.stringify({ url: body.url, custom_code: body.custom_code }),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return new Response(JSON.stringify(data), {
      status: upstream.status, headers: { "content-type": "application/json" },
    });
  }
  // Ensure short_url is absolute against the proxy domain
  if (data.code) {
    const short = `${publicBase}/s/${data.code}`;
    data.short_url = short;
    data.shortenedUrl = short;
  }
  return new Response(JSON.stringify(data), {
    status: 200, headers: { "content-type": "application/json" },
  });
}
