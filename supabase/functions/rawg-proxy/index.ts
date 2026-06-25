import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RAWG_API_KEY = Deno.env.get("RAWG_API_KEY") || "";
const RAWG_BASE_URL = "https://api.rawg.io/api";

interface RequestPayload {
  endpoint: string;
  params?: Record<string, string>;
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

async function handleRequest(req: Request): Promise<Response> {
  const origin = req.headers.get("Origin") || "*";
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  if (!RAWG_API_KEY) {
    return new Response(JSON.stringify({ error: "RAWG API key not configured" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const body: RequestPayload = await req.json();
    const { endpoint, params = {} } = body;

    if (!endpoint || typeof endpoint !== "string") {
      return new Response(JSON.stringify({ error: "Invalid endpoint" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const url = new URL(`${RAWG_BASE_URL}/${endpoint}`);
    url.searchParams.set("key", RAWG_API_KEY);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "GameView/1.0" },
    });

    const data = await res.json();

    if (!res.ok) {
      return new Response(JSON.stringify({ error: data?.detail || data?.message || `RAWG API error: ${res.status}` }), {
        status: res.status,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(handleRequest);