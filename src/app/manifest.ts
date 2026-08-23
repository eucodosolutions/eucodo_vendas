import type { MetadataRoute } from "next";

/**
 * Manifesto do PWA.
 *
 * `start_url` aponta para /vender e nao para a raiz: quem instala o painel
 * instala para vender, e a raiz so redireciona. Quem for admin cai no /vender e
 * o layout devolve para /admin, que custa um salto e vale a simplicidade de ter
 * um ponto de entrada so.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Eucodo Vendas",
    short_name: "Eucodo",
    description: "Painel de venda dos displays de avaliação do Google Meu Negócio.",
    start_url: "/vender",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f6f8",
    theme_color: "#0360fe",
    lang: "pt-BR",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png" },
      {
        // O maskable e recortado pelo Android em circulo, gota ou quadrado, e
        // por isso tem margem propria: sem ele, a marca sai com as bordas cortadas.
        src: "/icone-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
