import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const BASE = "https://api.reidoscanais.my";

export async function GET(request, context) {
  try {
    const params = await context.params;
    const path = params?.path || [];
    const incoming = new URL(request.url);
    let target;

    if (path[0] === "channels" && path.length === 1) {
      target = new URL("/channels", BASE);
      const category = incoming.searchParams.get("category");
      if (category) target.searchParams.set("category", category.slice(0, 80));
    } else if (path[0] === "channels" && path[1] === "categories") {
      target = new URL("/channels/categories", BASE);
    } else if (path[0] === "channels" && path[1]) {
      target = new URL(`/channels/${encodeURIComponent(path[1])}`, BASE);
    } else if (path[0] === "health") {
      target = new URL("/health", BASE);
    } else {
      return NextResponse.json({ error: "Rota Rei dos Canais não encontrada." }, { status: 404 });
    }

    const response = await fetch(target.toString(), {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; Smartflix/1.0)" },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(20000)
    });
    const body = await response.text();
    if (!response.ok) {
      return NextResponse.json({
        error: "Falha ao consultar Rei dos Canais.",
        upstreamStatus: response.status,
        upstreamUrl: target.toString(),
        detail: body.slice(0, 500)
      }, { status: response.status === 404 ? 404 : 502 });
    }
    let data;
    try { data = JSON.parse(body); }
    catch { return NextResponse.json({ error: "Rei dos Canais retornou JSON inválido." }, { status: 502 }); }
    return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=180, stale-while-revalidate=300" } });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao consultar Rei dos Canais.", detail: error?.message || "Erro desconhecido" }, { status: 502 });
  }
}