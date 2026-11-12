import "./globals.css";

export const metadata = {
  title: "CINEVERSE — Descubra seu próximo filme",
  description: "Explore filmes populares, tendências e grandes histórias no CINEVERSE."
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
