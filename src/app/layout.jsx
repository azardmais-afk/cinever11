import "./globals.css";

export const metadata = {
  title: "SMARTFLIX — Seu universo de filmes e séries",
  description: "Descubra filmes, séries, novidades e grandes histórias no SMARTFLIX."
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
