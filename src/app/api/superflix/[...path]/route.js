import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const BASE = "https://superflixapi.boats";

export async function GET(request, context) {
  try {
    const routeParams = await context.params;
    const [resource, category] = routeParams?.path || [];
    if (resource !== "catalog" || !["channels", "movies", "series", "anime", "dorama"].includes(category)) {
      return NextResponse.json({ error: "Rota SuperFlix não encontrada.", path: routeParams?.path || [] }, { status: 404 });
    }

    const incoming = new URL(request.url);
    const target = new URL("/lista", BASE);
    const configs = {
      channels: { category: "canais", format: "json" },
      movies: { category: "filme", type: "imdb", format: "json" },
      series: { category: "serie", type: "tmdb", order: "asc", format: "json" },
      anime: { category: "animes", format: "json" },
      dorama: { category: "dorama", format: "json" }
    };
    for (const [key, value] of Object.entries(configs[category])) target.searchParams.set(key, value);
    for (const key of ["q", "genre", "limit"]) {
      const value = incoming.searchParams.get(key);
      if (value) target.searchParams.set(key, value.slice(0, key === "q" ? 80 : 30));
    }

    const response = await fetch(target.toString(), {
      headers: { Accept: "application/json, text/plain, */*", "User-Agent": "Mozilla/5.0 (compatible; Smartflix/1.0)", Referer: "https://superflixapi.boats/" },
      redirect: "follow",
      cache: "no-store"
    });
    const body = await response.text();
    if (!response.ok) {
      return NextResponse.json({ error: "Falha ao consultar SuperFlix.", upstreamStatus: response.status, detail: body.slice(0, 300) }, { status: 502 });
    }
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: "A SuperFlix não retornou JSON válido.", detail: body.slice(0, 300) }, { status: 502 });
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" }
    });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao consultar canais da SuperFlix.", detail: error?.message || "Erro desconhecido" }, { status: 502 });
  }
}
