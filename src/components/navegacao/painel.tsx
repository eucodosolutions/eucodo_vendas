import type { ReactNode } from "react";

import { BarraInferior } from "./barra-inferior";
import { BarraLateral } from "./barra-lateral";
import { BarraSuperior } from "./barra-superior";
import { ConviteParaInstalar } from "@/components/convite-para-instalar";
import type { PapelUsuario } from "@/types/database";

/**
 * A moldura dos dois paineis, o do assinante e o da plataforma.
 *
 * O que muda entre eles e so o menu, que vem do papel. Manter uma moldura so
 * evita que o painel admin envelheca diferente do painel de quem vende.
 */
export function Painel({
  papel,
  nome,
  conta,
  children,
}: {
  papel: PapelUsuario;
  nome: string;
  conta: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col md:pl-60">
      <BarraLateral papel={papel} nome={nome} conta={conta} />
      <BarraSuperior conta={conta} />

      {/* pb-24 no celular: a barra de baixo cobriria o fim da pagina. */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6 pb-24 md:py-8">{children}</main>

      <BarraInferior papel={papel} />
      <ConviteParaInstalar />
    </div>
  );
}
