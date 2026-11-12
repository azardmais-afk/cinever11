"use client";

import { useEffect, useMemo, useState } from "react";

const IMG = "https://image.tmdb.org/t/p/";
const poster = (path, size = "w500") => path ? `${IMG}${size}${path}` : "";
const year = (date) => date ? date.slice(0, 4) : "—";
const score = (n) => Number(n || 0).toFixed(1);

export default function Home() {
  const [kind, setKind] = useState("movie");
  const [popular, setPopular] = useState([]);
  const [trending, setTrending] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [genres, setGenres] = useState([]);
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

  async function api(path) {
    const response = await fetch(`/api/tmdb/${path}`);
    if (!response.ok) throw new Error("Falha ao consultar o catálogo");
    return response.json();
  }

  async function loadCatalog(type = kind) {
    setLoading(true);
    setError("");
    try {
      const [p, t, top, g] = await Promise.all([
        api(`${type}/popular?language=pt-BR&page=1`),
        api(`trending/${type}/week?language=pt-BR`),
        api(`${type}/top_rated?language=pt-BR&page=1`),
        api(`genre/${type}/list?language=pt-BR`)
      ]);
      setPopular(p.results || []);
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
    setSeason(null);
    setEpisodes([]);
    try {
      const [data, watch] = await Promise.all([
        api(`${type}/${item.id}?language=pt-BR&append_to_response=credits,videos`),
        api(`${type}/${item.id}/watch/providers`)
      ]);
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
    setEpisodes([]);
    try {
      const data = await api(`tv/${id}/season/${number}?language=pt-BR`);
      setEpisodes(data.episodes || []);
    } catch (e) { console.error(e); }
  }

  const filtered = useMemo(() => genre
    ? popular.filter(item => item.genre_ids?.includes(Number(genre)))
    : popular, [popular, genre]);

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
      <nav><a href="#tendencias">Em alta</a><a href="#catalogo">Catálogo</a><a href="#avaliados">Mais avaliados</a></nav>
      <div className="search"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar filmes e séries..." aria-label="Buscar filmes e séries" />{query && <button onClick={() => setQuery("")} aria-label="Limpar busca">×</button>}</div>
    </header>

    {query.trim() ? <section className="search-results section">
      <div className="section-heading"><div><p className="eyebrow">PESQUISA</p><h2>Resultados para “{query}”</h2></div></div>
      {searching ? <p className="muted">Buscando filmes e séries...</p> : cards(results)}
    </section> : <>
      <section className="hero">
        <div className="hero-content"><p className="eyebrow">SEU UNIVERSO DE ENTRETENIMENTO</p>
          <h1>Histórias incríveis.<br /><em>Do seu jeito.</em></h1>
          <p className="hero-copy">Explore filmes, séries, lançamentos e clássicos. Descubra onde assistir aos seus próximos favoritos.</p>
          <a className="primary-btn" href="#catalogo">Explorar catálogo <span>→</span></a>
        </div>
        <div className="hero-glow" /><div className="hero-note"><span className="pulse" /> CATÁLOGO ATUALIZADO</div>
      </section>

      <section className="section" id="tendencias">
        <div className="section-heading"><div><p className="eyebrow">O QUE ESTÁ EM ALTA</p><h2>Tendências da <em>semana</em></h2></div><span className="section-count">SMARTFLIX</span></div>
        {loading ? <p className="muted">Carregando catálogo...</p> : cards(trending)}
      </section>

      <section className="section" id="catalogo">
        <div className="section-heading"><div><p className="eyebrow">DESCUBRA SEU PRÓXIMO FAVORITO</p><h2>Explore o <em>catálogo</em></h2></div></div>
        <div className="kind-switch"><button className={kind === "movie" ? "active" : ""} onClick={() => { setKind("movie"); setGenre(""); }}>Filmes</button><button className={kind === "tv" ? "active" : ""} onClick={() => { setKind("tv"); setGenre(""); }}>Séries</button></div>
        <div className="genre-list"><button className={!genre ? "active" : ""} onClick={() => setGenre("")}>Todos</button>{genres.map(g => <button key={g.id} className={String(g.id) === genre ? "active" : ""} onClick={() => setGenre(String(g.id))}>{g.name}</button>)}</div>
        {error ? <p className="error-message">{error}</p> : loading ? <p className="muted">Carregando...</p> : cards(filtered)}
      </section>

      <section className="section" id="avaliados">
        <div className="section-heading"><div><p className="eyebrow">ESCOLHAS DO PÚBLICO</p><h2>Mais <em>bem avaliados</em></h2></div></div>
        {loading ? <p className="muted">Carregando...</p> : cards(topRated)}
      </section>
    </>}

    <footer><a className="brand" href="#"><img className="footer-logo" src="/smartflix-logo.png" alt="Smartflix" /></a><span>Informações de filmes e séries fornecidas por TMDB.</span><span>© {new Date().getFullYear()} SMARTFLIX</span></footer>

    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}>
      <article className="modal" onClick={e => e.stopPropagation()}>
        <button className="close" onClick={() => setSelected(null)} aria-label="Fechar">×</button>
        <div className="modal-visual" style={{ backgroundImage: selected.backdrop_path ? `linear-gradient(90deg,#101014 0%,rgba(16,16,20,.72) 55%,rgba(16,16,20,.1)),url(${poster(selected.backdrop_path, "w1280")})` : "linear-gradient(90deg,#101014,#29232a)" }}>
          <div className="modal-title"><p className="eyebrow">{selected.media_type === "tv" ? "DETALHES DA SÉRIE" : "DETALHES DO FILME"}</p><h2>{selected.title || selected.name}</h2><p className="modal-stats">★ {score(selected.vote_average)}　·　{year(selected.release_date || selected.first_air_date)}　·　{details?.runtime ? `${details.runtime} min` : details?.number_of_seasons ? `${details.number_of_seasons} temporadas` : " "}</p></div>
        </div>
        <div className="modal-body">
          <p>{details?.overview || selected.overview || "Sinopse não disponível."}</p>
          {details?.genres?.length > 0 && <div className="chips">{details.genres.map(g => <span key={g.id}>{g.name}</span>)}</div>}
          {selected.media_type === "tv" && details?.seasons?.length > 0 && <div className="episode-panel"><h3>Temporadas e episódios</h3><div className="season-list">{details.seasons.filter(s => s.season_number >= 0).map(s => <button key={s.id} className={season === s.season_number ? "active" : ""} onClick={() => loadSeason(selected.id, s.season_number)}>{s.name}</button>)}</div>{episodes.length > 0 && <div className="episode-list">{episodes.map(ep => <div className="episode" key={ep.id}><strong>{ep.episode_number}. {ep.name}</strong><span>{ep.overview || "Sinopse não disponível."}</span></div>)}</div>}</div>}
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
