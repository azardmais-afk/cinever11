import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

const BASE = "https://api.themoviedb.org/3";

export async function GET(request, { params }) {
  const { env } = getCloudflareContext();
  const token = env.TMDB_API_READ_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "TMDB_API_READ_TOKEN não configurado no servidor." },
      { status: 500 }
    );
  }

  const segments = params.path || [];
  const endpoint = segments.map(encodeURIComponent).join("/");
  const incoming = new URL(request.url);
  const target = new URL(`${BASE}/${endpoint}`);
  incoming.searchParams.forEach((value, key) => target.searchParams.set(key, value));

  try {
    const response = await fetch(target.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      },
      next: { revalidate: 300 }
    });
    const body = await response.json();
    return NextResponse.json(body, { status: response.status });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar o TMDB." }, { status: 502 });
  }
}
