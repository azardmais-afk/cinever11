import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

const BASE = "https://nixplay.lat";

function credentials(env) {
  const username = env.REDEFLIX_VOD_USERNAME;
  const password = env.REDEFLIX_VOD_PASSWORD;
  if (!username || !password) throw new Error("Configure REDEFLIX_VOD_USERNAME e REDEFLIX_VOD_PASSWORD nos Secrets da Cloudflare.");
  return { username, password };
}

async function upstream(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error(`RedeFlix respondeu HTTP ${response.status}`);
  return response;
}

export async function GET(request, { params }) {
  try {
    const { env } = getCloudflareContext();
    const { username, password } = credentials(env);
    const parts = params.path || [];
    const [resource, id, season, episode] = parts;

    if (resource === "catalog" && (id === "movies" || id === "series")) {
      const url = new URL("/api/catalog.php", BASE);
      url.searchParams.set("username", username);
      url.searchParams.set("password", password);
      url.searchParams.set("type", id);
      const response = await upstream(url);
      const raw = await response.json();
      const items = Array.isArray(raw) ? raw : (raw.data || raw.results || raw.items || []);
      const normalized = items.map(item => ({
        id: String(item.id_tmdb || item.tmdb_id || item.tmdb || ""),
        sourceId: String(item.id || item.stream_id || item.id_tmdb || ""),
        title: item.title || item.name || item.movie_name || "Sem título",
        poster: item.poster || item.cover || item.stream_icon || item.poster_path || null,
        overview: item.overview || item.sinopse || "",
        year: String(item.year || item.ano || ""),
        type: id === "movies" ? "movie" : "tv",
        hasPlayback: Boolean(item.id_tmdb || item.tmdb_id || item.id)
      })).filter(item => item.id || item.sourceId);
      return NextResponse.json({ source: "redeflix", type: id, results: normalized });
    }

    if (resource === "status") {
      const url = new URL("/api/vod_status.php", BASE);
      url.searchParams.set("username", username);
      url.searchParams.set("password", password);
      const response = await upstream(url);
      return NextResponse.json(await response.json());
    }

    if (resource === "play" && id && (season === undefined || episode !== undefined)) {
      const media = season === undefined ? "movie" : "series";
      const segments = media === "movie"
        ? ["movie", username, password, id + ".mp4"]
        : ["series", username, password, id, season, episode + ".mp4"];
      const target = new URL("/" + segments.map(encodeURIComponent).join("/"), BASE);
      const response = await fetch(target, { redirect: "follow", cache: "no-store" });
      if (!response.ok) return NextResponse.json({ error: "Fonte RedeFlix indisponível para este título." }, { status: response.status });
      const headers = new Headers();
      for (const key of ["content-type", "content-length", "accept-ranges", "content-range"]) {
        const value = response.headers.get(key);
        if (value) headers.set(key, value);
      }
      headers.set("Cache-Control", "no-store");
      headers.set("Access-Control-Allow-Origin", "*");
      return new Response(response.body, { status: response.status, headers });
    }

    return NextResponse.json({ error: "Rota RedeFlix não encontrada." }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Erro ao consultar RedeFlix." }, { status: 502 });
  }
}
