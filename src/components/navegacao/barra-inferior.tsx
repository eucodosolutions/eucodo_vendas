"use client";

import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { dividirParaBarra, itemAtivo, itensDoPapel, type ItemDeMenu } from "./itens";
import { Modal } from "@/components/ui/modal";
import type { PapelUsuario } from "@/types/database";

const BOTAO =
  "flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 py-2 transition-colors";

/**
 * Navegacao do celular, no rodape.
 *
 * Fica embaixo porque o painel e usado com uma mao so, no meio de uma conversa
 * de venda: o polegar alcanca o rodape, nao o topo. O `env(safe-area-inset-bottom)`
 * e o que impede os botoes de ficarem debaixo da barra do iPhone.
 *
 * Cinco botoes e o limite: com seis, cada alvo fica menor que o dedo. O que nao
 * cabe vai para o "Mais", que abre a lista inteira em popup.
 */
export function BarraInferior({ papel }: { papel: PapelUsuario }) {
  const caminho = usePathname();
  const [maisAberto, setMaisAberto] = useState(false);

  const itens = itensDoPapel(papel);
  const ativo = itemAtivo(itens, caminho);
  const { visiveis, extras } = dividirParaBarra(itens);

  const maisAceso = extras.some((item) => item.href === ativo);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="flex">
          {visiveis.map((item) => (
            <li key={item.href} className="flex-1">
              <BotaoDeItem item={item} aceso={ativo === item.href} />
            </li>
          ))}

          {extras.length > 0 ? (
            <li className="flex-1">
              <button
                type="button"
                onClick={() => setMaisAberto(true)}
                aria-expanded={maisAberto}
                className={`${BOTAO} ${maisAceso ? "text-marca" : "text-tinta-suave"}`}
              >
                <Ellipsis size={20} aria-hidden />
                <span className="text-[0.6875rem] leading-none font-medium">Mais</span>
              </button>
            </li>
          ) : null}
        </ul>
      </nav>

      <Modal
        aberto={maisAberto}
        aoFechar={() => setMaisAberto(false)}
        titulo="Mais"
        tamanho="estreito"
      >
        <ul className="flex flex-col gap-1">
          {extras.map((item) => {
            const Icone = item.icone;
            const aceso = ativo === item.href;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={aceso ? "page" : undefined}
                  // Fecha no toque, e nao num efeito que observa a rota: a
                  // troca de pagina e a mesma acao, e esperar o roteador
                  // deixaria a lista por cima da tela nova por um instante.
                  onClick={() => setMaisAberto(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                    aceso ? "bg-marca-suave text-marca" : "text-tinta hover:bg-papel"
                  }`}
                >
                  <Icone size={18} aria-hidden />
                  {item.rotulo}
                </Link>
              </li>
            );
          })}
        </ul>
      </Modal>
    </>
  );
}

function BotaoDeItem({ item, aceso }: { item: ItemDeMenu; aceso: boolean }) {
  const Icone = item.icone;

  return (
    <Link
      href={item.href}
      aria-current={aceso ? "page" : undefined}
      className={`${BOTAO} ${aceso ? "text-marca" : "text-tinta-suave"}`}
    >
      <Icone size={20} aria-hidden />
      <span className="text-[0.6875rem] leading-none font-medium">{item.rotulo}</span>
    </Link>
  );
}
