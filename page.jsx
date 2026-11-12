 "use client";

import { useEffect, useMemo, useState } from "react";

const IMG = "https://image.tmdb.org/t/p/";
const poster = (path, size = "w500") => path ? `${IMG}${size}${path}` : "";
const year = (date) => date ? date.slice(0, 4) : "—";
const score = (n) => Number(n || 0).toFixed(1);
const titleOf = (item) => item.title || item.name || "Sem título";
const dateOf = (item) => item.release_date || item.first_air_date;
const playerUrl = (item, details, season, episode) => {
  if (item.media_type === "tv" || item.first_air_date || item.name) {
    return `https://myembed.biz/serie/${item.id}${season ? `/${season}/${episode || 1}` : ""}`;
  }
  const imdb = details?.external_ids?.imdb_id;
  return `https://myembed.biz/filme/${imdb || item.id}`;
};

export default function Home() {
  const [category, setCategory] = useState("all");
  const [trending, setTrending] = useState([]);
  const [movies, setMovies] = useState([]);
  const [series, setSeries] = useState([]);
  const [anime, setAnime] = useState([]);
  const [genres, setGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [showPlayer, setShowPlayer] = useState(false);

  async function api(path) {
    const response = await fetch(`/api/tmdb/${path}`);
    if (!response.ok) throw new Error("Falha ao consultar o catálogo");
    return response.json();
  }

  useEffect(() => {
    let alive = true;
    Promise.all([
      api("trending/all/week?language=pt-BR"),
      api("movie/popular?language=pt-BR&page=1"),
      api("tv/popular?language=pt-BR&page=1"),
      api("discover/tv?language=pt-BR&sort_by=popularity.desc&with_genres=16&page=1"),
      api("genre/movie/list?language=pt-BR"),
    ]).then(([t, m, tv, a, g]) => {
      if (!alive) return;
      setTrending((t.results || []).filter(x => x.media_type !== "person"));
      setMovies(m.results || []);
      setSeries(tv.results || []);
      setAnime(a.results || []);
      setGenres(g.genres || []);
    }).catch(console.error).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearching(false); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api(`search/multi?language=pt-BR&include_adult=false&query=${encodeURIComponent(query)}`);
        setResults((data.results || []).filter(x => x.media_type === "movie" || x.media_type === "tv"));
      } catch (e) { console.error(e); }
      finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  async function openTitle(item) {
    const type = item.media_type || (item.first_air_date || item.name ? "tv" : "movie");
    const normalized = { ...item, media_type: type };
    setSelected(normalized);
    setDetails(null);
    setSeason(1);
    setEpisode(1);
    setShowPlayer(false);
    try {
      const data = await api(`${type}/${item.id}?language=pt-BR&append_to_response=credits,videos,external_ids`);
      setDetails(data);
    } catch (e) { console.error(e); }
  }

  const filteredMovies = useMemo(() => selectedGenre
    ? movies.filter(x => x.genre_ids?.includes(Number(selectedGenre)))
    : movies, [movies, selectedGenre]);

  const cards = (items) => (
    <div className="movie-grid">
      {items.map(item => (
        <button className="movie-card" key={`${item.media_type || (item.first_air_date ? "tv" : "movie")}-${item.id}`} onClick={() => openTitle(item)} aria-label={`Ver detalhes de ${titleOf(item)}`}>
          <div className="poster-wrap">
            {item.poster_path ? <img src={poster(item.poster_path)} alt={`Pôster de ${titleOf(item)}`} loading="lazy" /> : <div className="no-poster">SMARTFLIX</div>}
            <span className="rating">★ {score(item.vote_average)}</span>
            <span className="type-tag">{item.media_type === "tv" || item.first_air_date ? "SÉRIE" : "FILME"}</span>
          </div>
          <div className="movie-meta"><strong>{titleOf(item)}</strong><span>{year(dateOf(item))}</span></div>
        </button>
      ))}
    </div>
  );

  const activeList = category === "movies" ? filteredMovies : category === "series" ? series : category === "anime" ? anime : trending;

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#"><img src="/smartflix-logo.png" alt="Smartflix" /></a>
        <nav>
          <button className={category === "all" ? "nav-active" : ""} onClick={() => {setCategory("all");setSelectedGenre("");}}>Início</button>
          <button className={category === "movies" ? "nav-active" : ""} onClick={() => {setCategory("movies");setSelectedGenre("");}}>Filmes</button>
          <button className={category === "series" ? "nav-active" : ""} onClick={() => setCategory("series")}>Séries</button>
          <button className={category === "anime" ? "nav-active" : ""} onClick={() => setCategory("anime")}>Animes</button>
        </nav>
        <div className="search"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar filmes e séries..." aria-label="Buscar filmes e séries" />{query && <button onClick={() => setQuery("")} aria-label="Limpar busca">×</button>}</div>
      </header>

      {query.trim() ? (
        <section className="search-results section">
          <div className="section-heading"><div><p className="eyebrow">PESQUISA</p><h2>Resultados para “{query}”</h2></div></div>
          {searching ? <p className="muted">Buscando filmes e séries...</p> : results.length ? cards(results) : <p className="muted">Nenhum resultado encontrado.</p>}
        </section>
      ) : (
        <>
          <section className="hero">
            <div className="hero-content">
              <p className="eyebrow">SEU UNIVERSO DE ENTRETENIMENTO</p>
              <h1>Seus próximos favoritos.<br /><em>Em um só lugar.</em></h1>
              <p className="hero-copy">Explore filmes, séries e animes: descubra novidades, veja detalhes e encontre onde começar a assistir.</p>
              <button className="primary-btn" onClick={() => document.getElementById("catalogo")?.scrollIntoView({behavior:"smooth"})}>Explorar catálogo <span>→</span></button>
            </div>
            <div className="hero-glow" /><div className="hero-note"><span className="pulse" /> CATÁLOGO ATUALIZADO</div>
          </section>

          <section className="section" id="catalogo">
            <div className="section-heading"><div><p className="eyebrow">DESCUBRA ALGO NOVO</p><h2>{category === "movies" ? <>Filmes <em>populares</em></> : category === "series" ? <>Séries <em>populares</em></> : category === "anime" ? <>Animes <em>em destaque</em></> : <>Em <em>tendência</em></>}</h2></div><span className="section-count">SMARTFLIX</span></div>
            <div className="genre-list">
              <button className={category === "all" ? "active" : ""} onClick={() => {setCategory("all");setSelectedGenre("");}}>Em alta</button>
              <button className={category === "movies" ? "active" : ""} onClick={() => {setCategory("movies");setSelectedGenre("");}}>Filmes</button>
              <button className={category === "series" ? "active" : ""} onClick={() => setCategory("series")}>Séries</button>
              <button className={category === "anime" ? "active" : ""} onClick={() => setCategory("anime")}>Animes</button>
            </div>
            {category === "movies" && <div className="genre-list genre-sub">{genres.map(g => <button key={g.id} className={String(g.id) === selectedGenre ? "active" : ""} onClick={() => setSelectedGenre(String(g.id) === selectedGenre ? "" : String(g.id))}>{g.name}</button>)}</div>}
            {loading ? <p className="muted">Carregando catálogo...</p> : activeList.length ? cards(activeList) : <p className="muted">Nenhum título disponível no momento.</p>}
          </section>
          {category === "all" && <section className="section"><div className="section-heading"><div><p className="eyebrow">PARA MARATONAR</p><h2>Séries <em>populares</em></h2></div></div>{loading ? <p className="muted">Carregando...</p> : cards(series)}</section>}
        </>
      )}

      <footer><a className="brand footer-brand" href="#"><img src="/smartflix-logo.png" alt="Smartflix" /></a><span>Informações e catálogo fornecidos por TMDB.</span><span>© {new Date().getFullYear()} SMARTFLIX</span></footer>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <article className="modal" onClick={e => e.stopPropagation()}>
            <button className="close" onClick={() => setSelected(null)} aria-label="Fechar">×</button>
            <div className="modal-visual" style={{backgroundImage:selected.backdrop_path ? `linear-gradient(90deg,#09090c 0%,rgba(9,9,12,.78) 55%,rgba(9,9,12,.15)),url(${poster(selected.backdrop_path,"w1280")})` : "linear-gradient(90deg,#09090c,#29101a)"}}>
              <div className="modal-title"><p className="eyebrow">{selected.media_type === "tv" ? "DETALHES DA SÉRIE" : "DETALHES DO FILME"}</p><h2>{titleOf(selected)}</h2><p className="modal-stats">★ {score(selected.vote_average)}　·　{year(dateOf(selected))}　·　{details?.runtime ? `${details.runtime} min` : details?.number_of_seasons ? `${details.number_of_seasons} temporadas` : ""}</p></div>
            </div>
            <div className="modal-body">
              <p>{details?.overview || selected.overview || "Sinopse não disponível."}</p>
              {details?.genres?.length > 0 && <div className="chips">{details.genres.map(g => <span key={g.id}>{g.name}</span>)}</div>}
              {details?.credits?.cast?.length > 0 && <div><h3>Elenco principal</h3><p className="muted">{details.credits.cast.slice(0,8).map(p=>p.name).join(" · ")}</p></div>}
              {selected.media_type === "tv" && details?.seasons?.filter(s => s.season_number > 0).length > 0 && <div className="episode-controls"><label>Temporada <select value={season} onChange={e=>{setSeason(Number(e.target.value));setEpisode(1);}}>{details.seasons.filter(s=>s.season_number>0).map(s=><option key={s.id} value={s.season_number}>{s.name}</option>)}</select></label><label>Episódio <input type="number" min="1" max="99" value={episode} onChange={e=>setEpisode(Math.max(1,Number(e.target.value)||1))}/></label></div>}
              {details ? <button className="primary-btn watch-btn" onClick={()=>setShowPlayer(true)}>▶ {showPlayer ? "Atualizar player" : "Assistir agora"}</button> : <p className="muted">Carregando detalhes...</p>}
              {showPlayer && details && <div className="player-wrap"><div className="player-heading"><strong>SMARTFLIX PLAYER</strong><span>Se o vídeo não carregar, tente novamente mais tarde.</span></div><iframe title={`Player de ${titleOf(selected)}`} src={playerUrl(selected,details,selected.media_type==="tv"?season:null,episode)} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>}
              <p className="legal-note">A disponibilidade do player depende do serviço externo e dos direitos de distribuição do conteúdo. Smartflix não hospeda vídeos.</p>
            </div>
          </article>
        </div>
      )}
    </main>
  );
}
