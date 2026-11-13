import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request, context) {
  try {
    const routeParams = await context.params;
    const [resource, category] = routeParams?.path || [];
    if (resource !== "catalog" || !["channels", "movies", "series", "anime", "dorama"].includes(category)) {
      return NextResponse.json({ error: "Rota SuperFlix não encontrada.", path: routeParams?.path || [] }, { status: 404 });
    }

    const incoming = new URL(request.url);

    // Canais: tenta o domínio principal e espelhos da própria SuperFlix
    // quando houver bloqueio temporário (ex.: HTTP 429) ou falha de conexão.
    if (category === "channels") {
      const params = new URLSearchParams({ category: "canais", format: "json" });
      for (const key of ["q", "genre", "limit"]) {
        const value = incoming.searchParams.get(key);
        if (value) params.set(key, value.slice(0, key === "q" ? 80 : 30));
      }
      const hosts = [
        "https://superflixapi.boats",
        "https://superflixapi.monster",
        "https://superflixapi.pro",
        "https://superflixapi.sbs",
        "https://superflixapi.beer",
        "https://superflixapi.baby"
      ];
      const attempts = [];
      for (const host of hosts) {
        const target = new URL("/lista", host);
        target.search = params.toString();
        try {
          const response = await fetch(target.toString(), {
            method: "GET",
            headers: {
              Accept: "application/json, text/plain, */*",
              "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
            },
            cache: "no-store",
            redirect: "follow",
            signal: AbortSignal.timeout(10000)
          });
          const body = await response.text();
          if (!response.ok) {
            attempts.push({ host, status: response.status, detail: body.slice(0, 160) });
            continue;
          }
          let data;
          try { data = JSON.parse(body); }
          catch {
            attempts.push({ host, status: response.status, detail: "Resposta não é JSON." });
            continue;
          }
          const roots = [data?.data, data?.result, data];
          const list = roots.flatMap(root => Array.isArray(root) ? [root] : [root?.channels, root?.items, root?.results, root?.data]).find(Array.isArray) || [];
          if (!list.length) {
            attempts.push({ host, status: response.status, detail: "A API respondeu sem canais." });
            continue;
          }
          return NextResponse.json(data, {
            headers: {
              "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
              "X-SuperFlix-Host": host.replace("https://", "")
            }
          });
        } catch (error) {
          attempts.push({ host, detail: error?.message || "Falha de conexão" });
        }
      }
      return NextResponse.json({
        error: "Não foi possível consultar a lista da SuperFlix nos domínios disponíveis.",
        tried: attempts.map(item => ({ ...item, host: item.host.replace("https://", "") }))
      }, { status: 502 });
    }

    // Os demais catálogos permanecem com a configuração anterior.
    const configs = {
      movies: { category: "filme", type: "imdb", format: "json" },
      series: { category: "serie", type: "tmdb", order: "asc", format: "json" },
      anime: { category: "animes", format: "json" },
      dorama: { category: "dorama", format: "json" }
    };
    const params = new URLSearchParams(configs[category]);
    const hosts = [
      "https://superflixapi.monster",
      "https://superflixapi.pro",
      "https://superflixapi.beer",
      "https://superflixapi.sbs",
      "https://superflixapi.baby",
      "https://superflixapi.boats"
    ];

    const attempts = [];
    for (const host of hosts) {
      const target = new URL("/lista", host);
      target.search = params.toString();
      try {
        const response = await fetch(target.toString(), {
          headers: {
            Accept: "application/json, text/plain, */*",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
            Referer: host + "/",
            Origin: host
          },
          redirect: "follow",
          cache: "no-store",
          signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) {
          attempts.push({ host, status: response.status });
          continue;
        }
        const body = await response.text();
        try {
          return NextResponse.json(JSON.parse(body), {
            headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" }
          });
        } catch {
          attempts.push({ host, status: response.status, detail: "Resposta não é JSON." });
        }
      } catch (error) {
        attempts.push({ host, detail: error?.message || "Falha de conexão" });
      }
    }

    return NextResponse.json({
      error: "Não foi possível consultar o catálogo da SuperFlix.",
      tried: attempts.map(item => ({ ...item, host: item.host.replace("https://", "") }))
    }, { status: 502 });
  } catch (error) {
    return NextResponse.json({
      error: "Erro ao consultar a SuperFlix.",
      detail: error?.message || "Erro desconhecido"
    }, { status: 502 });
  }
}
