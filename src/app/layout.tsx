import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

import { RegistrarServiceWorker } from "@/components/registrar-service-worker";
import { Avisos } from "@/components/ui/avisos";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Eucodo Vendas",
    template: "%s | Eucodo Vendas",
  },
  description: "Venda e producao dos displays de avaliacao do Google Meu Negocio.",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  // No iOS e isto, e nao o manifesto, que faz o app abrir sem a barra do Safari.
  appleWebApp: {
    capable: true,
    title: "Eucodo",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icone-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0360fe",
  // O painel e usado com uma mao so, e a barra inferior encosta na area do
  // iPhone: sem `viewport-fit`, o env(safe-area-inset-bottom) vem sempre zero.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${poppins.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <Avisos />
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
