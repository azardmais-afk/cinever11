import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const HOSTS = ["https://superflixapi.monster", "https://superflixapi.baby", "https://superflixapi.beer", "https://superflixapi.sbs", "https://superflixapi.pro", "https://superflixapi.boats"];

export async function GET(request, context) {
  try {
    const routeParams = await context.params;
    const [resource, category] = routeParams?.path || [];
    if (resource !== "catalog" || !["channels", "movies", "series", "anime", "dorama"].includes(category)) {
      return NextResponse.json({ error: "Rota SuperFlix não encontrada.", path: routeParams?.path || [] }, { status: 404 });
    }

    const incoming = new URL(request.url);
    const configs = {
      channels: { category: "canais", format: "json" },
      movies: { category: "filme", type: "imdb", format: "json" },
      series: { category: "serie", type: "tmdb", order: "asc", format: "json" },
      anime: { category: "animes", format: "json" },
      dorama: { category: "dorama", format: "json" }
    };
    const params = new URLSearchParams(configs[category]);
    for (const key of ["q", "genre", "limit"]) {
      const value = incoming.searchParams.get(key);
      if (value) params.set(key, value.slice(0, key === "q" ? 80 : 30));
    }

    let lastError = null;
    for (const host of HOSTS) {
      const target = new URL("/lista", host);
      target.search = params.toString();
      try {
        const response = await fetch(target.toString(), {
          headers: {
            Accept: "application/json, text/plain, */*",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
            Referer: host + "/canais"
          },
          redirect: "follow",
          cache: "no-store",
          signal: AbortSignal.timeout(9000)
        });
        const body = await response.text();
        if (!response.ok) {
          lastError = { host, status: response.status, detail: body.slice(0, 180) };
          continue;
        }
        let data;
        try {
          data = JSON.parse(body);
        } catch {
          lastError = { host, status: response.status, detail: "Resposta não é JSON." };
          continue;
        }
        return NextResponse.json(data, {
          headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300", "X-SuperFlix-Host": new URL(response.url || target).host }
        });
      } catch (error) {
        lastError = { host, detail: error?.message || "Falha de conexão" };
      }
    }
    return NextResponse.json({
      error: "Não foi possível consultar a lista da SuperFlix em nenhum domínio disponível.",
      tried: HOSTS.map(host => new URL(host).host),
      lastError
    }, { status: 502 });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao consultar canais da SuperFlix.", detail: error?.message || "Erro desconhecido" }, { status: 502 });
  }
}
