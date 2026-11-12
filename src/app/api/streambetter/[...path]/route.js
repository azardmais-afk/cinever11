import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const BASE = "https://streambetter.lat";

export async function GET(request, context) {
  try {
    const params = await context.params;
    const path = (params?.path || []).join("/");
    const allowed = new Set(["api/channels", "api/titles", "api/titles/ids", "api/recents/movies", "api/recents/series"]);
    if (!allowed.has(path)) {
      return NextResponse.json({ error: "Rota StreamBetter não permitida." }, { status: 404 });
    }
    const incoming = new URL(request.url);
    const target = new URL(`/${path}`, BASE);
    for (const key of ["type", "page", "limit", "after_id", "q", "category"]) {
      const value = incoming.searchParams.get(key);
      if (value) target.searchParams.set(key, value.slice(0, 100));
    }
    const response = await fetch(target.toString(), {
      headers: { Accept: "application/json" },
      redirect: "follow",
      next: { revalidate: path === "api/channels" ? 600 : 1800 }
    });
    const body = await response.text();
    if (!response.ok) {
      return NextResponse.json({ error: "Falha ao consultar StreamBetter.", upstreamStatus: response.status }, { status: 502 });
    }
    let data;
    try { data = JSON.parse(body); }
    catch { return NextResponse.json({ error: "StreamBetter retornou JSON inválido." }, { status: 502 }); }
    return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao consultar StreamBetter.", detail: error?.message || "Erro desconhecido" }, { status: 502 });
  }
}
