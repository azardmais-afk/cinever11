import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const BASE = "https://redeflixapi.click";

export async function GET(_request, context) {
  try {
    const params = await context.params;
    const parts = params?.path || [];
    const [resource, type] = parts;
    const paths = {
      movies: "/list-movie-ids.txt",
      series: "/list-tv-ids.txt",
      anime: "/list-anime-ids.txt",
      dorama: "/list-dorama-ids.txt"
    };
    if (resource !== "catalog" || !paths[type]) {
      return NextResponse.json({ error: "Rota RedeFlix não encontrada." }, { status: 404 });
    }
    const response = await fetch(BASE + paths[type], {
      headers: { Accept: "text/plain, application/json" },
      cache: "no-store"
    });
    if (!response.ok) {
      return NextResponse.json({ error: `RedeFlix respondeu HTTP ${response.status}` }, { status: response.status });
    }
    const body = await response.text();
    return new Response(body, {
      headers: {
        "Content-Type": response.headers.get("content-type") || (type === "movies" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8"),
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Erro ao consultar RedeFlix." }, { status: 502 });
  }
}
