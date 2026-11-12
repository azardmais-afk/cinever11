import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const BASE = "https://superflixapi.boats";

export async function GET(request, { params }) {
  try {
    const [resource, category] = params.path || [];
    if (resource !== "catalog" || category !== "channels") {
      return NextResponse.json({ error: "Rota SuperFlix não encontrada." }, { status: 404 });
    }
    const incoming = new URL(request.url);
    const target = new URL("/lista", BASE);
    target.searchParams.set("category", "canais");
    target.searchParams.set("format", "json");
    for (const key of ["q", "genre", "limit"]) {
      const value = incoming.searchParams.get(key);
      if (value) target.searchParams.set(key, value.slice(0, key === "q" ? 80 : 30));
    }
    const response = await fetch(target, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) {
      return NextResponse.json({ error: `SuperFlix respondeu HTTP ${response.status}` }, { status: response.status });
    }
    const body = await response.text();
    return new Response(body, {
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8",
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300"
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Erro ao consultar canais." }, { status: 502 });
  }
}
