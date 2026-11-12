import "./globals.css";

export const metadata = {
  title: "Smartflix — Filmes, séries e animes",
  description: "Descubra filmes, séries e animes no Smartflix."
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
