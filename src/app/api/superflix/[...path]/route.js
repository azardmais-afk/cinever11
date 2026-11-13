import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const HOSTS = ["https://superflixapi.monster", "https://superflixapi.pro", "https://superflixapi.sbs", "https://superflixapi.beer", "https://superflixapi.baby", "https://superflixapi.boats"];

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
      // Keep the default channels request exactly category=canais&format=json.
      // The UI sends a default limit for other providers; only forward it when filtering.
      if (value && !(category === "channels" && key === "limit" && !incoming.searchParams.has("q") && !incoming.searchParams.has("genre"))) {
        params.set(key, value.slice(0, key === "q" ? 80 : 30));
      }
    }

    // Channels use the same SuperFlix API across its available mirror domains.
    // Try the user-provided domain first, then the service mirrors if it rejects the request.
    const hosts = category === "channels"
      ? ["https://superflixapi.monster", "https://superflixapi.boats", "https://superflixapi.pro", ...HOSTS.filter(host => !["https://superflixapi.monster", "https://superflixapi.boats", "https://superflixapi.pro"].includes(host))]
      : HOSTS;
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
            Origin: host,
            ...(category === "channels" ? {} : { Referer: host + "/canais" })
          },
          redirect: "follow",
          cache: "no-store",
          signal: AbortSignal.timeout(20000)
        });
        if (!response.ok) { attempts.push({ ok: false, host, status: response.status, detail: (await response.text()).slice(0, 160) }); continue; }
        const body = await response.text();
        try {
          const data = JSON.parse(body);
          const roots = [data?.data, data?.result, data];
          const list = roots.flatMap(root => Array.isArray(root) ? [root] : [root?.channels, root?.items, root?.results, root?.data]).find(Array.isArray) || [];
          if (category === "channels" && !list.length) { attempts.push({ ok: false, host, status: response.status, detail: "A API respondeu sem canais." }); continue; }
          attempts.push({ ok: true, host, data });
          break;
        } catch {
          attempts.push({ ok: false, host, status: response.status, detail: "Resposta não é JSON." });
        }
      } catch (error) {
        attempts.push({ ok: false, host, detail: error?.message || "Falha de conexão" });
      }
    }
    const success = attempts.find(result => result.ok);
    if (success) {
      return NextResponse.json(success.data, {
        headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300", "X-SuperFlix-Host": success.host.replace("https://", "") }
      });
    }
    return NextResponse.json({
      error: "Não foi possível consultar a lista da SuperFlix em nenhum domínio disponível.",
      tried: attempts.map(({ host, status, detail }) => ({ host: host.replace("https://", ""), status: status || null, detail: detail || null }))
    }, { status: 502 });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao consultar canais da SuperFlix.", detail: error?.message || "Erro desconhecido" }, { status: 502 });
  }
}
