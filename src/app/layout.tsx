import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${poppins.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <Avisos />
      </body>
    </html>
  );
}
