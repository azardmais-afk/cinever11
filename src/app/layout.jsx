import "./globals.css";
import ServiceWorkerRegistration from "./ServiceWorkerRegistration";

export const metadata = {
  title: "SMARTFLIX — Seu universo de filmes e séries",
  description: "Descubra filmes, séries, novidades e grandes histórias no SMARTFLIX."
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <script src="https://quge5.com/88/tag.min.js" data-zone="309775" async data-cfasync="false"></script>
      </head>
      <body>{children}<ServiceWorkerRegistration /></body>
    </html>
  );
}
