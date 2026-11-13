"use client";

import { useEffect, useMemo, useState } from "react";

const IMG = "https://image.tmdb.org/t/p/";
const poster = (path, size = "w500") => path ? (String(path).startsWith("http") ? path : `${IMG}${size}${path}`) : "";
const year = (date) => date ? date.slice(0, 4) : "—";
const score = (n) => Number(n || 0).toFixed(1);

export default function Home() {
  const [kind, setKind] = useState("movie");
  const [popular, setPopular] = useState([]);
  const [trending, setTrending] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [genres, setGenres] = useState([]);
  const [catalogCounts, setCatalogCounts] = useState({ movies: null, series: null, anime: null, dorama: null });
  const [genre, setGenre] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const [trailer, setTrailer] = useState("");
  const [providers, setProviders] = useState([]);
  const [providerLink, setProviderLink] = useState("");
  const [season, setSeason] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playerSource, setPlayerSource] = useState("megaembed");
  const [megaDomain, setMegaDomain] = useState("mgeb.space");
  const megaDomains = ["mgeb.space", "mgeb.lat", "mgeb.casa", "mgeb.quest"];
  const [redeflixEpisode, setRedeflixEpisode] = useState({ season: 1, episode: 1 });
  const [activeTab, setActiveTab] = useState("home");
  const [channels, setChannels] = useState([]);
  const [channelQuery, setChannelQuery] = useState("");
  const [channelGenre, setChannelGenre] = useState("");
  const [channelLoading, setChannelLoading] = useState(false);
  const [channelError, setChannelError] = useState("");
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [channelPlayerSource, setChannelPlayerSource] = useState("superflix");
  const [channelServer, setChannelServer] = useState("superflix");
  const [channelEmbedIndex, setChannelEmbedIndex] = useState(0);

  function extractIds(payload) {
    const found = [];
    const visit = value => {
      if (typeof value === "string" || typeof value === "number") {
        const id = String(value).trim();
        if (/^(tt\d+|\d+)$/.test(id)) found.push(id);
      } else if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") {
        for (const key of ["id", "imdb_id", "tmdb_id", "imdb", "tmdb", "items", "results", "data", "ids", "titles"]) {
          if (value[key] !== undefined) visit(value[key]);
        }
      }
    };
    visit(payload);
    return [...new Set(found)];
  }


  function normalizeChannels(payload) {
    // Normaliza envelopes distintos sem descartar os links próprios de cada API.
    const root = payload?.data ?? payload?.result ?? payload;
    const rows = Array.isArray(root) ? root
      : Array.isArray(root?.channels) ? root.channels
      : Array.isArray(root?.items) ? root.items
      : Array.isArray(root?.results) ? root.results
      : Array.isArray(payload?.channels) ? payload.channels
      : Array.isArray(payload?.items) ? payload.items
      : Array.isArray(payload?.results) ? payload.results
      : [];
    return rows.filter(item => item && (item.is_active === undefined || item.is_active === true)).map((item, index) => {
      const name = item.name || item.nome || item.title || item.titulo || item.channel || item.canal || `Canal ${index + 1}`;
      const slug = item.slug || item.id || name.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const embeds = Array.isArray(item.embeds) ? item.embeds.filter(embed => embed && (embed.embed_url || embed.url || embed.src)) : [];
      const stream = item.embed_url || item.embedUrl || item.iframe_url || item.player_url || item.stream_url || item.stream || item.url_stream || item.url || item.player || item.iframe || embeds[0]?.embed_url || embeds[0]?.url || embeds[0]?.src || "";
      return {
        id: item.id ?? item.channel_id ?? slug ?? index,
        name,
        genre: item.category || item.genre || item.genero || item.categoria || (Array.isArray(item.categories) ? item.categories.map(value => typeof value === "object" ? value.name : value).join(", ") : ""),
        logo: item.logo_url || item.logo || item.logoUrl || item.image || item.poster || item.icon || "",
        stream,
        embeds,
        slug: String(slug)
      };
    }).filter(item => item.name);
  }

  async function loadChannels(q = channelQuery, g = channelGenre, server = channelServer) {
    setChannelLoading(true);
    setChannelError("");
    setChannels([]);
    try {
      const params = new URLSearchParams({ limit: "100", page: "1" });
      if (q.trim()) params.set("q", q.trim());
      if (g) params.set(server === "superflix" ? "genre" : "category", g);

      let rows = [];
      if (server === "superflix") {
        // SuperFlix uses only its own /lista?category=canais API.
        const response = await fetch(`/api/superflix/catalog/channels?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`SuperFlix respondeu HTTP ${response.status}`);
        rows = normalizeChannels(await response.json()).map(channel => ({ ...channel, source: "superflix" }));
      } else if (server === "streambetter") {
        // StreamBetter uses only its own /api/channels API.
        const response = await fetch(`/api/streambetter/api/channels?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`StreamBetter respondeu HTTP ${response.status}`);
        const payload = await response.json();
        const pages = Math.min(20, Math.max(1, Number(payload?.pagination?.totalPages || 1)));
        const extra = await Promise.all(Array.from({ length: pages - 1 }, (_, index) => {
          const pageParams = new URLSearchParams(params);
          pageParams.set("page", String(index + 2));
          return fetch(`/api/streambetter/api/channels?${pageParams.toString()}`, { cache: "no-store" })
            .then(r => r.ok ? r.json() : null).catch(() => null);
        }));
        rows = [...normalizeChannels(payload), ...extra.flatMap(normalizeChannels)].map(channel => ({ ...channel, source: "streambetter" }));
      } else if (server === "reidosembeds") {
        // Rei dos Embeds uses only its own /api/channels API.
        const response = await fetch(`/api/reidosembeds/channels?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Rei dos Embeds respondeu HTTP ${response.status}`);
        rows = normalizeChannels(await response.json()).map(channel => ({ ...channel, source: "reidosembeds" }));
      } else if (server === "reidoscanais") {
        const categoryName = ({ esportes: "Esportes", noticias: "Notícias", filmes: "Filmes", infantil: "Infantil", abertos: "Canais Abertos" })[g] || g;
        const response = await fetch("/api/reidoscanais/channels" + (categoryName ? "?category=" + encodeURIComponent(categoryName) : ""), { cache: "no-store" });
        if (!response.ok) throw new Error(`Rei dos Canais respondeu HTTP ${response.status}`);
        rows = normalizeChannels(await response.json()).map(channel => ({ ...channel, source: "reidoscanais" }));
        if (q.trim()) rows = rows.filter(channel => channel.name.toLowerCase().includes(q.trim().toLowerCase()));
      } else {
        throw new Error("Servidor de canais desconhecido.");
      }
      const unique = new Map(rows.map(channel => [String(channel.id || channel.slug || channel.name).toLowerCase(), channel]));
      rows = [...unique.values()];
      if (!rows.length) throw new Error("A API respondeu, mas não retornou canais em um formato reconhecido.");
      setChannels(rows);
    } catch (e) {
      console.error(`Erro ao carregar canais de ${server}:`, e);
      setChannels([]);
      const label = server === "superflix" ? "SuperFlix" : server === "streambetter" ? "StreamBetter" : server === "reidosembeds" ? "Rei dos Embeds" : "Rei dos Canais";
      setChannelError(`${label}: ${e?.message || "não foi possível carregar os canais"}. Tente novamente.`);
    } finally {
      setChannelLoading(false);
    }
  }

  async function api(path) {
    const response = await fetch(`/api/tmdb/${path}`);
    if (!response.ok) throw new Error("Falha ao consultar o catálogo");
    return response.json();
  }

  async function loadCatalog(type = kind) {
    setLoading(true);
    setError("");
    try {
      if (type === "anime" || type === "dorama") {
        const categoryPath = type === "anime" ? "animes" : "doramas";
        const [streamResponse, redeflixResponse, superflixResponse, movieGenresResponse, tvGenresResponse] = await Promise.all([
          fetch(`/api/streambetter/api/${categoryPath}?page=1&limit=100`).catch(() => null),
          fetch(`/api/redeflix/catalog/${type}`).catch(() => null),
          fetch(`/api/superflix/catalog/${type}`).catch(() => null),
          api("genre/movie/list?language=pt-BR").catch(() => ({ genres: [] })),
          api("genre/tv/list?language=pt-BR").catch(() => ({ genres: [] }))
        ]);
        const streamPayload = streamResponse?.ok ? await streamResponse.json().catch(() => null) : null;
        const redeflixText = redeflixResponse?.ok ? await redeflixResponse.text().catch(() => "") : "";
        const superPayload = superflixResponse?.ok ? await superflixResponse.json().catch(() => null) : null;
        const streamTitles = Array.isArray(streamPayload?.titles) ? streamPayload.titles : [];
        const streamItems = await Promise.all(streamTitles.map(async item => {
          const id = Number(item.tmdb_id || item.id_tmdb || item.id);
          if (!id) return null;
          const rawType = String(item.type || item.media_type || "").toLowerCase();
          const preferred = ["movie", "film", "filme"].includes(rawType) ? "movie" : "tv";
          try {
            const resolved = await api(`${preferred}/${id}?language=pt-BR`);
            return { ...resolved, id, media_type: preferred, genre_ids: resolved.genre_ids || (resolved.genres || []).map(genre => genre.id), catalogCategory: type, streambetter: true };
          } catch {
            return {
              id, title: item.title || item.name || "Título sem nome", name: item.title || item.name || "Título sem nome",
              poster_path: item.poster_path || "", overview: item.overview || "",
              release_date: item.release_date || "", first_air_date: item.first_air_date || "",
              vote_average: Number(item.vote_average || 0), genre_ids: item.genre_ids || (item.genres || []).map(genre => genre.id), media_type: preferred,
              catalogCategory: type, streambetter: true
            };
          }
        }));
        const redeIds = redeflixText.split(/\s+/).map(value => value.trim()).filter(value => /^\d+$/.test(value));
        const superIds = extractIds(superPayload).filter(value => /^\d+$/.test(value));
        const extraIds = [...new Set([...redeIds, ...superIds])].filter(id => !streamTitles.some(item => String(item.tmdb_id || item.id_tmdb || item.id) === id)).slice(0, 40);
        const extraItems = await Promise.all(extraIds.map(async value => {
          const id = Number(value);
          for (const mediaType of ["tv", "movie"]) {
            try {
              const resolved = await api(`${mediaType}/${id}?language=pt-BR`);
              return { ...resolved, id, media_type: mediaType, genre_ids: resolved.genre_ids || (resolved.genres || []).map(genre => genre.id), catalogCategory: type, redeflix: redeIds.includes(value), superflix: superIds.includes(value) };
            } catch {}
          }
          return null;
        }));
        const unique = new Map();
        for (const item of [...streamItems, ...extraItems].filter(Boolean)) {
          const key = `${item.media_type}-${item.id}`;
          if (!unique.has(key)) unique.set(key, item);
          else unique.set(key, { ...unique.get(key), ...item, streambetter: unique.get(key).streambetter || item.streambetter, redeflix: unique.get(key).redeflix || item.redeflix, superflix: unique.get(key).superflix || item.superflix });
        }
        setPopular([...unique.values()]);
        const rankedItems = [...unique.values()].sort((a, b) => Number(b.vote_average || 0) - Number(a.vote_average || 0));
        setTrending(rankedItems.slice(0, 20));
        setTopRated(rankedItems.slice(0, 20));
        const combinedGenres = new Map([...(movieGenresResponse?.genres || []), ...(tvGenresResponse?.genres || [])].map(item => [item.id, item]));
        setGenres([...combinedGenres.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
        return;
      }
      const [p, t, top, g] = await Promise.all([
        api(`${type}/popular?language=pt-BR&page=1`),
        api(`trending/${type}/week?language=pt-BR`),
        api(`${type}/top_rated?language=pt-BR&page=1`),
        api(`genre/${type}/list?language=pt-BR`)
      ]);
      
      let freeItems = [];
      try {
        if (type === "movie") {
          const idsText = await fetch("/api/redeflix/catalog/movies").then(r => r.ok ? r.text() : "");
          const ids = [...new Set(idsText.split(/\s+/).map(x => x.trim()).filter(x => /^\d+$/.test(x)))].slice(0, 24);
          const extra = await Promise.all(ids.map(async id => { try { return await api(`movie/${id}?language=pt-BR`); } catch { return null; } }));
          freeItems = extra.filter(Boolean).map(item => ({ ...item, media_type: "movie", redeflix: true }));
        } else {
          const raw = await fetch("/api/redeflix/catalog/series").then(r => r.ok ? r.json() : null);
          freeItems = (raw?.items || []).map(item => ({ id: Number(item.id_tmdb), name: item.nome, title: item.nome, first_air_date: String(item.ano || ""), media_type: "tv", overview: "", redeflix: true, redeflixSeasons: item.temporadas || {} })).filter(item => item.id);
        }
      } catch (freeError) { console.warn("RedeFlix gratuita indisponível", freeError); }
      let streamBetterItems = [];
      try {
        const response = await fetch(`/api/streambetter/api/titles?type=${type === "movie" ? "movie" : "tv"}&limit=30`);
        if (response.ok) {
          const payload = await response.json();
          const titles = (payload?.titles || []).filter(item => item.tmdb_id).slice(0, 24);
          const found = await Promise.all(titles.map(async title => {
            try {
              const item = await api(`${type === "movie" ? "movie" : "tv"}/${title.tmdb_id}?language=pt-BR`);
              return { ...item, media_type: type, streambetter: true };
            } catch { return null; }
          }));
          streamBetterItems = found.filter(Boolean);
        }
      } catch (streamBetterError) { console.warn("Catálogo StreamBetter indisponível", streamBetterError); }
      let superItems = [];
      try {
        const categories = type === "movie" ? ["movies"] : ["series", "anime", "dorama"];
        const payloads = await Promise.all(categories.map(async category => {
          try {
            const response = await fetch(`/api/superflix/catalog/${category}`);
            return response.ok ? await response.json() : [];
          } catch { return []; }
        }));
        const ids = [...new Set(payloads.flatMap(extractIds))].slice(0, 30);
        if (type === "movie") {
          const found = await Promise.all(ids.filter(id => id.startsWith("tt")).map(async imdbId => {
            try {
              const match = await api(`find/${imdbId}?external_source=imdb_id&language=pt-BR`);
              const item = match.movie_results?.[0];
              return item ? { ...item, media_type: "movie", superflixImdbId: imdbId, superflix: true } : null;
            } catch { return null; }
          }));
          superItems = found.filter(Boolean);
        } else {
          const found = await Promise.all(ids.filter(id => /^\d+$/.test(id)).map(async id => {
            try {
              const item = await api(`tv/${id}?language=pt-BR`);
              return { ...item, media_type: "tv", superflix: true };
            } catch { return null; }
          }));
          superItems = found.filter(Boolean);
        }
      } catch (superError) { console.warn("Catálogo SuperFlix indisponível", superError); }
      const merged = [...(p.results || []), ...freeItems, ...superItems, ...streamBetterItems];
      const unique = new Map();
      for (const item of merged) {
        const key = `${item.media_type || type}-${item.id}`;
        if (!unique.has(key)) unique.set(key, item);
        else unique.set(key, { ...unique.get(key), ...item, superflix: unique.get(key).superflix || item.superflix, superflixImdbId: unique.get(key).superflixImdbId || item.superflixImdbId, redeflix: unique.get(key).redeflix || item.redeflix, streambetter: unique.get(key).streambetter || item.streambetter });
      }
      setPopular([...unique.values()]);
      setTrending(t.results || []);
      setTopRated(top.results || []);
      setGenres(g.genres || []);
    } catch (e) {
      console.error(e);
      setError("Não foi possível carregar o catálogo. Confira a variável TMDB_API_READ_TOKEN na Cloudflare.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    const safe = async (url, type = "json") => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) return null;
        return type === "text" ? await response.text() : await response.json();
      } catch { return null; }
    };
    const countText = value => new Set(String(value || "").split(/\s+/).map(x => x.trim()).filter(x => /^\d+$/.test(x))).size;
    const countAvailable = (...values) => {
      const ids = values.flatMap(value => extractIds(value));
      return new Set(ids).size;
    };
    (async () => {
      const [redeMovies, redeSeries, redeAnime, redeDorama, superMovies, superSeries, superAnime, superDorama, streamBetterIds] = await Promise.all([
        safe("/api/redeflix/catalog/movies", "text"),
        safe("/api/redeflix/catalog/series"),
        safe("/api/redeflix/catalog/anime", "text"),
        safe("/api/redeflix/catalog/dorama", "text"),
        safe("/api/superflix/catalog/movies"),
        safe("/api/superflix/catalog/series"),
        safe("/api/superflix/catalog/anime"),
        safe("/api/superflix/catalog/dorama"),
        safe("/api/streambetter/api/titles/ids")
      ]);
      const seriesIds = Array.isArray(redeSeries?.items) ? redeSeries.items.map(x => String(x.id_tmdb || "")).filter(Boolean) : [];
      const next = {
        movies: countText(redeMovies) + extractIds(superMovies).length + Number(streamBetterIds?.counts?.movie || 0),
        series: new Set([...seriesIds, ...extractIds(superSeries)]).size + Number(streamBetterIds?.counts?.tv || 0),
        anime: countAvailable(redeAnime, superAnime) + Number(streamBetterIds?.counts?.anime || 0),
        dorama: countAvailable(redeDorama, superDorama) + Number(streamBetterIds?.counts?.dorama || 0)
      };
      if (active) setCatalogCounts(next);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => { loadCatalog(kind); }, [kind]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearching(false); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api(`search/multi?language=pt-BR&include_adult=false&query=${encodeURIComponent(query)}`);
        setResults((data.results || []).filter(item => item.media_type === "movie" || item.media_type === "tv"));
      } catch (e) { console.error(e); }
      finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  async function openTitle(item) {
    const type = item.media_type || (item.first_air_date !== undefined ? "tv" : "movie");
    setSelected({ ...item, media_type: type });
    setDetails(null);
    setTrailer("");
    setProviders([]);
    setProviderLink("");
    setPlayerSource("megaembed");
    setRedeflixEpisode({ season: 1, episode: 1 });
    setSeason(null);
    setEpisodes([]);
    try {
      const [data, watch, external] = await Promise.all([
        api(`${type}/${item.id}?language=pt-BR&append_to_response=credits,videos`),
        api(`${type}/${item.id}/watch/providers`),
        api(`${type}/${item.id}/external_ids`).catch(() => ({}))
      ]);
      const superflixImdbId = type === "movie" ? (external.imdb_id || item.superflixImdbId || "") : "";
      setSelected(current => ({ ...current, superflix: type === "tv" || Boolean(superflixImdbId) || Boolean(item.superflix), superflixImdbId }));
      setDetails(data);
      const video = (data.videos?.results || []).find(v => v.site === "YouTube" && v.type === "Trailer")
        || (data.videos?.results || []).find(v => v.site === "YouTube");
      if (video) setTrailer(`https://www.youtube.com/watch?v=${video.key}`);
      const br = watch.results?.BR;
      setProviders(br?.flatrate || br?.free || br?.ads || br?.rent || br?.buy || []);
      setProviderLink(br?.link || "");
      if (type === "tv" && data.seasons?.length) {
        const first = data.seasons.find(s => s.season_number > 0) || data.seasons[0];
        setSeason(first.season_number);
        loadSeason(item.id, first.season_number);
      }
    } catch (e) { console.error(e); }
  }

  async function loadSeason(id, number) {
    setSeason(number);
    setRedeflixEpisode({ season: number, episode: 1 });
    setEpisodes([]);
    try {
      const data = await api(`tv/${id}/season/${number}?language=pt-BR`);
      setEpisodes(data.episodes || []);
    } catch (e) { console.error(e); }
  }

  const filtered = useMemo(() => {
    if (!genre) return popular;
    const selectedGenreId = Number(genre);
    return popular.filter(item => {
      const ids = Array.isArray(item.genre_ids) ? item.genre_ids : Array.isArray(item.genres) ? item.genres.map(entry => Number(entry.id)) : [];
      return ids.includes(selectedGenreId);
    });
  }, [popular, genre]);

  function cards(items) {
    if (!items.length) return <p className="muted">Nenhum título encontrado.</p>;
    return <div className="movie-grid">
      {items.map(item => {
        const title = item.title || item.name || "Título sem nome";
        return <button className="movie-card" key={`${item.media_type || kind}-${item.id}`} onClick={() => openTitle(item)} aria-label={`Ver detalhes de ${title}`}>
          <div className="poster-wrap">
            {item.poster_path ? <img src={poster(item.poster_path)} alt={`Pôster de ${title}`} loading="lazy" /> : <div className="no-poster">SMARTFLIX</div>}
            <span className="rating">★ {score(item.vote_average)}</span>
            {item.media_type && <span className="type-tag">{item.media_type === "tv" ? "SÉRIE" : "FILME"}</span>}
          </div>
          <div className="movie-meta"><strong>{title}</strong><span>{year(item.release_date || item.first_air_date)}</span></div>
        </button>;
      })}
    </div>;
  }

  return <main>
    <header className="topbar">
      <a className="brand" href="#"><img className="brand-logo" src="/smartflix-logo.png" alt="Smartflix" /></a>
      <nav><button className={activeTab === "home" ? "nav-active" : ""} onClick={() => setActiveTab("home")}>Início</button><button className={activeTab === "tv" ? "nav-active" : ""} onClick={() => { setActiveTab("tv"); setChannelServer("superflix"); loadChannels("", "", "superflix"); }}>TV Online</button><a href="#tendencias" onClick={() => setActiveTab("home")}>Em alta</a><a href="#catalogo" onClick={() => setActiveTab("home")}>Catálogo</a></nav>
      <div className="search"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar filmes e séries..." aria-label="Buscar filmes e séries" />{query && <button onClick={() => setQuery("")} aria-label="Limpar busca">×</button>}</div>
    </header>

    {activeTab === "tv" ? <section className="section tv-online" id="tv-online"><div className="section-heading"><div><p className="eyebrow">TRANSMISSÃO AO VIVO</p><h2>TV <em>Online</em></h2></div></div><div className="channel-server-switch" aria-label="Servidor de canais"><button className={channelServer === "superflix" ? "active" : ""} onClick={() => { setChannelServer("superflix"); loadChannels(channelQuery, channelGenre, "superflix"); }}>SuperFlix</button><button className={channelServer === "streambetter" ? "active" : ""} onClick={() => { setChannelServer("streambetter"); loadChannels(channelQuery, channelGenre, "streambetter"); }}>StreamBetter</button><button className={channelServer === "reidosembeds" ? "active" : ""} onClick={() => { setChannelServer("reidosembeds"); loadChannels(channelQuery, channelGenre, "reidosembeds"); }}>Rei dos Embeds</button><button className={channelServer === "reidoscanais" ? "active" : ""} onClick={() => { setChannelServer("reidoscanais"); setChannelGenre(""); loadChannels(channelQuery, "", "reidoscanais"); }}>Rei dos Canais · Novo</button></div><div className="tv-filters"><input value={channelQuery} onChange={e => setChannelQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") loadChannels(); }} placeholder="Buscar canal (ex.: sportv)" /><select value={channelGenre} onChange={e => { setChannelGenre(e.target.value); loadChannels(channelQuery, e.target.value, channelServer); }}><option value="">Todos os gêneros</option><option value="esportes">Esportes</option><option value="noticias">Notícias</option><option value="filmes">Filmes</option><option value="infantil">Infantil</option><option value="abertos">Canais abertos</option></select><button className="primary-btn" onClick={() => loadChannels()}>Buscar</button></div>{channelLoading ? <p className="muted">Carregando canais...</p> : channelError ? <p className="error-message">{channelError}</p> : channels.length ? <div className="channel-grid">{channels.map(ch => <button className="channel-card" key={ch.id} onClick={() => { setSelectedChannel(ch); setChannelEmbedIndex(0); setChannelPlayerSource(ch.source || channelServer); }}><div className="channel-logo">{ch.logo ? <img src={ch.logo} alt="" /> : <span>TV</span>}</div><strong>{ch.name}</strong><small>{ch.genre || "Canal ao vivo"}</small></button>)}</div> : <p className="muted">Nenhum canal encontrado. Toque em Buscar para carregar a lista.</p>}</section> : query.trim() ? <section className="search-results section">
      <div className="section-heading"><div><p className="eyebrow">PESQUISA</p><h2>Resultados para “{query}”</h2></div></div>
      {searching ? <p className="muted">Buscando filmes e séries...</p> : cards(results)}
    </section> : <>
      {(() => {
        const featured = trending[0] || popular[0];
        const totalTitles = catalogCounts.movies !== null && catalogCounts.series !== null ? catalogCounts.movies + catalogCounts.series : null;
        return <>
          <section className="hero netflix-hero" style={featured?.backdrop_path ? { backgroundImage: `linear-gradient(90deg,rgba(0,0,0,.94) 0%,rgba(0,0,0,.62) 48%,rgba(0,0,0,.12) 100%),linear-gradient(0deg,#080808 0%,transparent 45%),url(${poster(featured.backdrop_path,"w1280")})` } : undefined}>
            <div className="hero-content">
              <p className="eyebrow">DESTAQUE SMARTFLIX</p>
              <h1>{featured ? (featured.title || featured.name) : "Filmes e séries para você"}</h1>
              <p className="hero-copy">{featured?.overview || "Descubra filmes, séries, animes e doramas para assistir quando quiser."}</p>
              <div className="hero-actions">
                {featured && <button className="primary-btn hero-watch" onClick={() => openTitle(featured)}>▶ Assistir</button>}
                {featured && <button className="secondary-btn" onClick={() => openTitle(featured)}>ⓘ Mais informações</button>}
              </div>
            </div>
          </section>
          <div className="catalog-total">Catálogo carregado · {totalTitles === null ? "contando títulos nas listas..." : totalTitles.toLocaleString("pt-BR") + " títulos encontrados nas listas consultadas."}</div>
        </>;
      })()}

      <section className="section" id="tendencias">
        <div className="section-heading"><div><h2>Em alta agora</h2></div></div>
        {loading ? <p className="muted">Carregando catálogo...</p> : cards(trending)}
      </section>

      <section className="section" id="catalogo">
        <div className="section-heading"><div><p className="eyebrow">DESCUBRA SEU PRÓXIMO FAVORITO</p><h2>Explore o <em>catálogo</em></h2></div></div>
      <section className="catalog-stats" aria-label="Quantidade de títulos nos catálogos">
        <div className="catalog-stats-heading"><span className="eyebrow">CATÁLOGO SMARTFLIX</span><h2>Explore milhares de títulos</h2><p>Quantidade disponível nas listas conectadas</p></div>
        <div className="catalog-stat"><strong>{catalogCounts.movies === null ? "…" : catalogCounts.movies.toLocaleString("pt-BR")}</strong><span>Filmes</span></div>
        <div className="catalog-stat"><strong>{catalogCounts.series === null ? "…" : catalogCounts.series.toLocaleString("pt-BR")}</strong><span>Séries</span></div>
        <div className="catalog-stat"><strong>{catalogCounts.anime === null ? "…" : catalogCounts.anime.toLocaleString("pt-BR")}</strong><span>Animes</span></div>
        <div className="catalog-stat"><strong>{catalogCounts.dorama === null ? "…" : catalogCounts.dorama.toLocaleString("pt-BR")}</strong><span>Doramas</span></div>
      </section>

        
        <div className="genre-list"><button className={!genre ? "active" : ""} onClick={() => setGenre("")}>Todos</button>{genres.map(g => <button key={g.id} className={String(g.id) === genre ? "active" : ""} onClick={() => setGenre(String(g.id))}>{g.name}</button>)}</div>
        {error ? <p className="error-message">{error}</p> : loading ? <p className="muted">Carregando...</p> : cards(filtered)}
      </section>

      <section className="section" id="avaliados">
        <div className="section-heading"><div><h2>Mais bem avaliados</h2></div></div>
        {loading ? <p className="muted">Carregando...</p> : cards(topRated)}
      </section>
    </>}

    <nav className="mobile-dock" aria-label="Navegação principal">
      <button type="button" className={activeTab === "home" && kind === "movie" ? "active" : ""} onClick={() => { setActiveTab("home"); setKind("movie"); window.scrollTo({ top: 0, behavior: "smooth" }); }}><span className="dock-icon">⌂</span><span>Início</span></button>
      <button type="button" className={activeTab === "tv" ? "active" : ""} onClick={() => { setActiveTab("tv"); setChannelServer("superflix"); loadChannels("", "", "superflix"); window.scrollTo({ top: 0, behavior: "smooth" }); }}><span className="dock-icon">▣</span><span>TV Online</span></button>
      <button type="button" className={activeTab === "home" && kind === "movie" ? "active" : ""} onClick={() => { setActiveTab("home"); setKind("movie"); document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" }); }}><span className="dock-icon">▣</span><span>Filmes</span></button>
      <button type="button" className={activeTab === "home" && kind === "tv" ? "active" : ""} onClick={() => { setActiveTab("home"); setKind("tv"); document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" }); }}><span className="dock-icon">▤</span><span>Séries</span></button>
      <button type="button" className={activeTab === "home" && kind === "anime" ? "active" : ""} onClick={() => { setActiveTab("home"); setKind("anime"); setGenre(""); document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" }); }}><span className="dock-icon">✦</span><span>Animes</span></button>
      <button type="button" className={activeTab === "home" && kind === "dorama" ? "active" : ""} onClick={() => { setActiveTab("home"); setKind("dorama"); setGenre(""); document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" }); }}><span className="dock-icon">♡</span><span>Doramas</span></button>
    </nav>
    <footer><a className="brand" href="#"><img className="footer-logo" src="/smartflix-logo.png" alt="Smartflix" /></a><span>Informações de filmes e séries fornecidas por TMDB.</span><span>© {new Date().getFullYear()} SMARTFLIX</span></footer>

    {selectedChannel && <div className="modal-backdrop" onClick={() => setSelectedChannel(null)}><article className="modal channel-modal" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setSelectedChannel(null)} aria-label="Fechar">×</button><div className="modal-body"><h2>{selectedChannel.name}</h2>{selectedChannel.source === "reidoscanais" && selectedChannel.embeds?.length > 1 && <div className="channel-embed-options">{selectedChannel.embeds.map((embed, index) => <button key={embed.embed_url} className={selectedChannel.stream === embed.embed_url ? "active" : ""} onClick={() => setSelectedChannel({ ...selectedChannel, stream: embed.embed_url })}>{embed.provider || `Player ${index + 1}`} {embed.quality ? `· ${embed.quality}` : ""}</button>)}</div>}<div className="embed-player">{selectedChannel.source === "streambetter" ? <iframe src={`https://streambetter.shop/canal/${selectedChannel.slug}`} title={selectedChannel.name} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /> : selectedChannel.stream ? (/\.(m3u8|mp4)(\?|$)/i.test(selectedChannel.stream) ? <video controls autoPlay playsInline src={selectedChannel.stream} /> : <iframe src={selectedChannel.stream} title={selectedChannel.name} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />) : <p className="muted">Este canal não possui um link de reprodução disponível.</p>}</div><p className="muted">Transmissão fornecida por {selectedChannel.source === "streambetter" ? "StreamBetter" : selectedChannel.source === "reidosembeds" ? "Rei dos Embeds" : selectedChannel.source === "reidoscanais" ? "Rei dos Canais" : "SuperFlix"}.</p></div></article></div>}
    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}>
      <article className="modal" onClick={e => e.stopPropagation()}>
        <button className="close" onClick={() => setSelected(null)} aria-label="Fechar">×</button>
        <div className="modal-visual" style={{ backgroundImage: selected.backdrop_path ? `linear-gradient(90deg,#101014 0%,rgba(16,16,20,.72) 55%,rgba(16,16,20,.1)),url(${poster(selected.backdrop_path, "w1280")})` : "linear-gradient(90deg,#101014,#29232a)" }}>
          <div className="modal-title"><p className="eyebrow">{selected.media_type === "tv" ? "DETALHES DA SÉRIE" : "DETALHES DO FILME"}</p><h2>{selected.title || selected.name}</h2><p className="modal-stats">★ {score(selected.vote_average)}　·　{year(selected.release_date || selected.first_air_date)}　·　{details?.runtime ? `${details.runtime} min` : details?.number_of_seasons ? `${details.number_of_seasons} temporadas` : " "}</p></div>
        </div>
        <div className="modal-body">
          <section className="embed-section">
            <h3>Assistir agora</h3>
            <div className="kind-switch player-options"><button className={playerSource === "embedmovies" ? "active" : ""} onClick={() => setPlayerSource("embedmovies")}>Player 1</button><button className={playerSource === "redeflix" ? "active" : ""} onClick={() => setPlayerSource("redeflix")}>Player 2</button>{selected.superflix && <button className={playerSource === "superflix" ? "active" : ""} onClick={() => setPlayerSource("superflix")}>Player 3</button>}<button className={playerSource === "megaembed" ? "active" : ""} onClick={() => setPlayerSource("megaembed")}>Player 4</button><button className={playerSource === "streambetter" ? "active" : ""} onClick={() => setPlayerSource("streambetter")}>Player 5</button><button className={playerSource === "jvembed" ? "active" : ""} onClick={() => setPlayerSource("jvembed")}>Player 6</button></div>
            {selected.media_type === "tv" && (playerSource === "redeflix" || playerSource === "megaembed" || playerSource === "streambetter" || playerSource === "jvembed") && <div className="season-list episode-selectors"><label>Temporada <select value={redeflixEpisode.season} onChange={e => setRedeflixEpisode(v => ({ ...v, season: Number(e.target.value), episode: 1 }))}>{Object.keys(selected.redeflixSeasons || Object.fromEntries((details?.seasons || []).filter(item => item.season_number > 0).map(item => [item.season_number, item.episode_count]))).map(s => <option key={s} value={s}>{s}</option>)}</select></label><label>Episódio <select value={redeflixEpisode.episode} onChange={e => setRedeflixEpisode(v => ({ ...v, episode: Number(e.target.value) }))}>{Array.from({ length: Math.min(100, Math.max(1, Number((details?.seasons || []).find(item => item.season_number === redeflixEpisode.season)?.episode_count || selected.redeflixSeasons?.[redeflixEpisode.season] || 30)) ) }, (_, index) => index + 1).map(number => <option key={number} value={number}>{number}</option>)}</select></label></div>}
            {playerSource === "megaembed" && <div className="season-list domain-selector"><label>Opção de reprodução <select value={megaDomain} onChange={e => setMegaDomain(e.target.value)}>{megaDomains.map((domain, index) => <option key={domain} value={domain}>Opção {index + 1}</option>)}</select></label></div>}
            <div className="embed-player">
              <iframe
                src={playerSource === "jvembed" ? (selected.media_type === "tv" ? `https://jvembed.digitalweb.host/watch/tv/${selected.id}/${redeflixEpisode.season}/${redeflixEpisode.episode}` : `https://jvembed.digitalweb.host/watch/movie/${selected.id}`) : playerSource === "streambetter" ? (selected.media_type === "tv" ? `https://streambetter.shop/serie/${selected.id}/${redeflixEpisode.season}/${redeflixEpisode.episode}` : `https://streambetter.shop/filme/${selected.id}`) : playerSource === "megaembed" ? `https://${megaDomain}/embed/${selected.id}${selected.media_type === "tv" ? `/${redeflixEpisode.season}/${redeflixEpisode.episode}` : ""}` : playerSource === "superflix" ? (selected.media_type === "tv" ? `https://superflixapi.boats/serie/${selected.id}` : `https://superflixapi.boats/filme/${selected.superflixImdbId || selected.id}`) : playerSource === "redeflix" ? (selected.media_type === "tv" ? `https://redeflixapi.click/serie/${selected.id}/${redeflixEpisode.season}/${redeflixEpisode.episode}` : `https://redeflixapi.click/filme/${selected.id}`) : (selected.media_type === "tv" ? `https://myembed.biz/serie/${selected.id}/${redeflixEpisode.season}/${redeflixEpisode.episode}` : `https://myembed.biz/filme/${selected.id}`)}
                title={`Player de ${selected.title || selected.name}`}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            <p className="muted">A reprodução é fornecida por uma fonte externa. A disponibilidade pode variar.</p>
          </section>
          <p>{details?.overview || selected.overview || "Sinopse não disponível."}</p>
          {details?.genres?.length > 0 && <div className="chips">{details.genres.map(g => <span key={g.id}>{g.name}</span>)}</div>}
          {selected.media_type === "tv" && details?.seasons?.length > 0 && <div className="episode-panel"><h3>Temporadas e episódios</h3><div className="season-list">{details.seasons.filter(s => s.season_number >= 0).map(s => <button key={s.id} className={season === s.season_number ? "active" : ""} onClick={() => loadSeason(selected.id, s.season_number)}>{s.name}</button>)}</div>{episodes.length > 0 && <div className="episode-list">{episodes.map(ep => <button type="button" className={redeflixEpisode.season === season && redeflixEpisode.episode === ep.episode_number ? "episode active" : "episode"} key={ep.id} onClick={() => { setRedeflixEpisode({ season: season ?? 1, episode: ep.episode_number }); setPlayerSource(current => ["redeflix", "megaembed", "streambetter", "jvembed"].includes(current) ? current : "jvembed"); document.querySelector(".embed-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} aria-label={`Reproduzir episódio ${ep.episode_number}: ${ep.name}`}><strong>{ep.episode_number}. {ep.name}</strong><span>{ep.overview || "Sinopse não disponível."}</span><small>▶ Tocar episódio</small></button>)}</div>}</div>}
          {details?.credits?.cast?.length > 0 && <div><h3>Elenco principal</h3><p className="muted">{details.credits.cast.slice(0, 8).map(p => p.name).join(" · ")}</p></div>}
          {providers.length > 0 && <div className="provider-panel"><h3>Onde assistir no Brasil</h3><div className="provider-list">{providers.map(p => <div className="provider" key={p.provider_id}>{p.logo_path && <img src={poster(p.logo_path, "w92")} alt="" />}<span>{p.provider_name}</span></div>)}</div>{providerLink && <a className="primary-btn trailer" href={providerLink} target="_blank" rel="noreferrer">Ver opções oficiais ↗</a>}</div>}
          {providers.length === 0 && providerLink && <div className="provider-panel"><h3>Onde assistir</h3><a className="primary-btn trailer" href={providerLink} target="_blank" rel="noreferrer">Consultar opções oficiais ↗</a></div>}
          {trailer && <a className="primary-btn trailer" href={trailer} target="_blank" rel="noreferrer">Assistir trailer ↗</a>}
          {!details && <p className="muted">Carregando detalhes...</p>}
          {details && !providers.length && !providerLink && <p className="muted">Não há opções de streaming informadas pelo catálogo para o Brasil neste momento.</p>}
        </div>
      </article>
    </div>}
  </main>;
}
