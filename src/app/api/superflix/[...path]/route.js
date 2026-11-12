import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const BASE = "https://superflixapi.boats";

const endpoints = {
  movies: "/lista?category=filme&type=imdb&format=json",
  series: "/lista?category=serie&type=tmdb&order=asc&format=json",
  anime: "/lista?category=animes&format=json",
  dorama: "/lista?category=dorama&format=json",
  channels: "/lista?category=canais&format=json"
};

export async function GET(_request, { params }) {
  try {
    const [resource, category] = params.path || [];
    if (resource !== "catalog" || !endpoints[category]) {
      return NextResponse.json({ error: "Rota SuperFlix não encontrada." }, { status: 404 });
    }
    const response = await fetch(BASE + endpoints[category], {
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
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Erro ao consultar SuperFlix." }, { status: 502 });
  }
}
