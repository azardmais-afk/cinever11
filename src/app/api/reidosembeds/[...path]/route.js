import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const BASE = "https://reidosembeds.lat";

export async function GET(request, context) {
  try {
    const params = await context.params;
    const [resource] = params?.path || [];
    if (resource !== "channels") {
      return NextResponse.json({ error: "Rota Rei dos Embeds não encontrada." }, { status: 404 });
    }
    const incoming = new URL(request.url);
    const target = new URL("/api/channels", BASE);
    const category = incoming.searchParams.get("category");
    if (category) target.searchParams.set("category", category.slice(0, 80));
    const response = await fetch(target.toString(), {
      headers: { Accept: "application/json" },
      redirect: "follow",
      cache: "no-store"
    });
    const body = await response.text();
    if (!response.ok) {
      return NextResponse.json({ error: "Falha ao consultar Rei dos Embeds.", upstreamStatus: response.status, detail: body.slice(0, 300) }, { status: 502 });
    }
    let data;
    try { data = JSON.parse(body); }
    catch { return NextResponse.json({ error: "Rei dos Embeds retornou JSON inválido." }, { status: 502 }); }
    return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao consultar Rei dos Embeds.", detail: error?.message || "Erro desconhecido" }, { status: 502 });
  }
}
