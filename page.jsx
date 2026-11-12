 "use client";

import { useEffect, useMemo, useState } from "react";

const IMG = "https://image.tmdb.org/t/p/";
const poster = (path, size = "w500") => path ? `${IMG}${size}${path}` : "";
const year = (date) => date ? date.slice(0, 4) : "—";
const score = (n) => Number(n || 0).toFixed(1);

export default function Home() {
  const [popular, setPopular] = useState([]);
  const [trending, setTrending] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [genres, setGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const [trailer, setTrailer] = useState("");
  const [loading, setLoading] = useState(true);

  async function api(path) {
    const response = await fetch(`/api/tmdb/${path}`);
    if (!response.ok) throw new Error("Falha ao consultar o catálogo");
    return response.json();
  }

  useEffect(() => {
    let alive = true;
    Promise.all([
      api("movie/popular?language=pt-BR&page=1"),
      api("trending/movie/week?language=pt-BR"),
      api("movie/top_rated?language=pt-BR&page=1"),
      api("genre/movie/list?language=pt-BR")
    ]).then(([p, t, top, g]) => {
      if (!alive) return;
      setPopular(p.results || []);
      setTrending(t.results || []);
      setTopRated(top.results || []);
      setGenres(g.genres || []);
    }).catch(console.error).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearching(false); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api(`search/movie?language=pt-BR&include_adult=false&query=${encodeURIComponent(query)}`);
        setResults(data.results || []);
      } catch (e) { console.error(e); }
      finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  async function openMovie(movie) {
    setSelected(movie);
    setDetails(null);
    setTrailer("");
    try {
      const data = await api(`movie/${movie.id}?language=pt-BR&append_to_response=credits,videos`);
      setDetails(data);
      const video = (data.videos?.results || []).find(v => v.site === "YouTube" && v.type === "Trailer")
        || (data.videos?.results || []).find(v => v.site === "YouTube");
      if (video) setTrailer(`https://www.youtube.com/watch?v=${video.key}`);
    } catch (e) { console.error(e); }
  }

  const filtered = useMemo(() => selectedGenre
    ? popular.filter(movie => movie.genre_ids?.includes(Number(selectedGenre)))
    : popular, [popular, selectedGenre]);

  const cards = (items) => (
    <div className="movie-grid">
      {items.map(movie => (
        <button className="movie-card" key={movie.id} onClick={() => openMovie(movie)} aria-label={`Ver detalhes de ${movie.title}`}>
          <div className="poster-wrap">
            {movie.poster_path
              ? <img src={poster(movie.poster_path)} alt="" loading="lazy" />
              : <div className="no-poster">CINEVERSE</div>}
            <span className="rating">★ {score(movie.vote_average)}</span>
          </div>
          <div className="movie-meta">
            <strong>{movie.title}</strong>
            <span>{year(movie.release_date)}</span>
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark">C</span>CINEVERSE</a>
        <nav><a href="#tendencias">Tendências</a><a href="#populares">Filmes</a><a href="#avaliados">Mais avaliados</a></nav>
        <div className="search">
          <span>⌕</span>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar filmes..." aria-label="Buscar filmes" />
          {query && <button onClick={() => setQuery("")} aria-label="Limpar busca">×</button>}
        </div>
      </header>

      {query.trim() ? (
        <section className="search-results section">
          <div className="section-heading"><div><p className="eyebrow">PESQUISA</p><h2>Resultados para “{query}”</h2></div></div>
          {searching ? <p className="muted">Buscando filmes...</p> : results.length ? cards(results) : <p className="muted">Nenhum filme encontrado.</p>}
        </section>
      ) : (
        <>
          <section className="hero">
            <div className="hero-content">
              <p className="eyebrow">SEU UNIVERSO DE CINEMA</p>
              <h1>Grandes histórias.<br /><em>Uma infinidade</em> de mundos.</h1>
              <p className="hero-copy">Explore lançamentos, clássicos e os filmes que todo mundo está assistindo.</p>
              <a className="primary-btn" href="#tendencias">Explorar catálogo <span>→</span></a>
            </div>
            <div className="hero-glow" />
            <div className="hero-note"><span className="pulse" /> ATUALIZADO COM TMDB</div>
          </section>

          <section className="section" id="tendencias">
            <div className="section-heading"><div><p className="eyebrow">EM ALTA AGORA</p><h2>O que está em <em>tendência</em></h2></div><span className="section-count">01 / DESTAQUES</span></div>
            {loading ? <p className="muted">Carregando catálogo...</p> : cards(trending)}
          </section>

          <section className="section" id="populares">
            <div className="section-heading"><div><p className="eyebrow">ESCOLHA SEU PRÓXIMO FILME</p><h2>Filmes <em>populares</em></h2></div></div>
            <div className="genre-list">
              <button className={!selectedGenre ? "active" : ""} onClick={() => setSelectedGenre("")}>Todos</button>
              {genres.map(g => <button key={g.id} className={String(g.id) === selectedGenre ? "active" : ""} onClick={() => setSelectedGenre(String(g.id))}>{g.name}</button>)}
            </div>
            {cards(filtered)}
          </section>

          <section className="section" id="avaliados">
            <div className="section-heading"><div><p className="eyebrow">NOTA DO PÚBLICO</p><h2>Os mais <em>bem avaliados</em></h2></div></div>
            {cards(topRated)}
          </section>
        </>
      )}

      <footer><a className="brand" href="#"><span className="brand-mark">C</span>CINEVERSE</a><span>Filmes e informações fornecidos por TMDB.</span><span>© {new Date().getFullYear()} CINEVERSE</span></footer>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <article className="modal" onClick={e => e.stopPropagation()}>
            <button className="close" onClick={() => setSelected(null)} aria-label="Fechar">×</button>
            <div className="modal-visual" style={{ backgroundImage: selected.backdrop_path ? `linear-gradient(90deg,#101014 0%,rgba(16,16,20,.72) 55%,rgba(16,16,20,.1)),url(${poster(selected.backdrop_path, "w1280")})` : "linear-gradient(90deg,#101014,#29232a)" }}>
              <div className="modal-title"><p className="eyebrow">DETALHES DO FILME</p><h2>{selected.title}</h2><p className="modal-stats">★ {score(selected.vote_average)}　·　{year(selected.release_date)}　·　{details?.runtime ? `${details.runtime} min` : "Duração indisponível"}</p></div>
            </div>
            <div className="modal-body">
              <p>{details?.overview || selected.overview || "Sinopse não disponível."}</p>
              {details?.genres?.length > 0 && <div className="chips">{details.genres.map(g => <span key={g.id}>{g.name}</span>)}</div>}
              {details?.credits?.cast?.length > 0 && <div><h3>Elenco principal</h3><p className="muted">{details.credits.cast.slice(0, 8).map(p => p.name).join(" · ")}</p></div>}
              {trailer && <a className="primary-btn trailer" href={trailer} target="_blank" rel="noreferrer">Assistir trailer no YouTube ↗</a>}
              {!details && <p className="muted">Carregando detalhes...</p>}
            </div>
          </article>
        </div>
      )}
    </main>
  );
}
