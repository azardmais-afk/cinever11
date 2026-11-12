# CINEVERSE

Catálogo de filmes responsivo usando a API do TMDB, com pesquisa, filtros por gênero,
detalhes, elenco e links para trailers no YouTube.

## Requisitos
- Node.js 20.9 ou superior
- Token de leitura da API do TMDB

## Rodar localmente
1. Instale as dependências: `npm install`
2. Copie `.env.example` para `.env.local`
3. Preencha `TMDB_API_READ_TOKEN` com seu Bearer token do TMDB
4. Rode `npm run dev` e abra http://localhost:3000

## Deploy na Vercel
- Importe este projeto como Next.js.
- Configure `TMDB_API_READ_TOKEN` nas Environment Variables (Production, Preview e Development).
- Deixe Root Directory vazio (raiz do projeto) e Output Directory em branco/automático.
- Faça o deploy.

O token é utilizado exclusivamente pela rota de servidor `src/app/api/tmdb/[...path]/route.js`.
