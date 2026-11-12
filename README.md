# SMARTFLIX

Catálogo responsivo de filmes, séries e animes com busca, gêneros, detalhes, elenco e player externo EmbedMovies.

## Configuração necessária no Cloudflare

Em Workers & Pages → seu Worker → Settings → Variables and Secrets, crie ou confirme:

- **Type:** Variable (ou Secret, recomendado)
- **Name:** `TMDB_API_READ_TOKEN`
- **Value:** seu token Bearer de leitura da API do TMDB

Marque Production e, se usar previews, Previews. Salve com **Add variable and deploy**. Não coloque o token no código, no GitHub ou em arquivos públicos.

## Como funciona

- O catálogo e as informações vêm da API oficial do TMDB.
- O player é incorporado via iframe do EmbedMovies (`myembed.biz`): filmes usam o IMDb ID quando disponível e o ID TMDB como alternativa; séries usam o ID TMDB e permitem selecionar temporada/episódio.
- A disponibilidade do vídeo depende do serviço externo. O Smartflix não hospeda vídeos nem garante que todo título tenha player disponível.

## Deploy automático

O repositório conectado ao Cloudflare deve estar configurado para acompanhar a branch `main`. Cada commit enviado ao GitHub dispara um novo build/deploy. Build command: `npx opennextjs-cloudflare build`; deploy command: `npx opennextjs-cloudflare deploy`.

## Rodar localmente

1. `npm install`
2. Configure `TMDB_API_READ_TOKEN` no ambiente local.
3. `npm run dev`

## Créditos

Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB. O player externo é fornecido por EmbedMovies. Respeite os direitos autorais e os termos dos serviços usados.
