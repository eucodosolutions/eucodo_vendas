import {
  Building2,
  LayoutDashboard,
  Package,
  ReceiptText,
  Settings,
  Store,
  UserRoundCog,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { PapelUsuario } from "@/types/database";

export type ItemDeMenu = { href: string; rotulo: string; icone: LucideIcon };

/**
 * O menu de cada papel, numa lista so.
 *
 * A barra lateral do desktop e a barra inferior do celular leem daqui. Fossem
 * duas listas, uma tela nova entraria em uma e sumiria na outra, e o bug so
 * apareceria no aparelho de quem nao esta olhando.
 *
 * A ordem importa: no celular ela e a ordem dos botoes na barra de baixo, e o
 * primeiro item e para onde o painel abre. O que nao couber la vai para o
 * "Mais", entao os itens do dia a dia vem primeiro e os de configurar, no fim.
 */
const MENU: Record<PapelUsuario, ItemDeMenu[]> = {
  admin: [
    { href: "/admin", rotulo: "Dashboard", icone: LayoutDashboard },
    { href: "/admin/assinantes", rotulo: "Assinantes", icone: Building2 },
  ],
  assinante: [
    { href: "/vender", rotulo: "Vender", icone: Store },
    { href: "/pedidos", rotulo: "Pedidos", icone: ReceiptText },
    { href: "/clientes", rotulo: "Clientes", icone: Users },
    { href: "/produtos", rotulo: "Produtos", icone: Package },
    { href: "/equipe", rotulo: "Equipe", icone: UserRoundCog },
    { href: "/ajustes", rotulo: "Ajustes", icone: Settings },
  ],
  vendedor: [
    { href: "/vender", rotulo: "Vender", icone: Store },
    { href: "/pedidos", rotulo: "Pedidos", icone: ReceiptText },
    { href: "/clientes", rotulo: "Clientes", icone: Users },
  ],
};

/** Quantos botoes cabem na barra do celular sem virar alvo pequeno demais. */
const CABEM_NA_BARRA = 5;

export function itensDoPapel(papel: PapelUsuario): ItemDeMenu[] {
  return MENU[papel];
}

/** Para onde cada papel vai quando entra ou quando cai numa rota que nao e dele. */
export function inicioDoPapel(papel: PapelUsuario): string {
  return MENU[papel][0].href;
}

/**
 * O item ativo e o de caminho mais longo que casa com a rota.
 *
 * Sem isso `/admin` ficaria aceso junto com `/admin/assinantes`, porque um e
 * prefixo do outro.
 */
export function itemAtivo(itens: ItemDeMenu[], caminho: string): string | null {
  const candidatos = itens
    .filter((item) => caminho === item.href || caminho.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length);

  return candidatos[0]?.href ?? null;
}

/**
 * Corta o menu no que cabe na barra do celular e no que sobra para o "Mais".
 *
 * Quando sobra alguma coisa, o ultimo espaco da barra deixa de ser um item e
 * passa a ser o botao que abre o resto — por isso o corte e em `CABEM_NA_BARRA
 * - 1`. Com menu curto, `extras` volta vazio e a barra continua como sempre foi.
 *
 * O corte mora aqui, junto da lista, e nao no componente: a barra desenha o que
 * recebe, e quem decide o que entra e quem conhece a ordem.
 */
export function dividirParaBarra(itens: ItemDeMenu[]): {
  visiveis: ItemDeMenu[];
  extras: ItemDeMenu[];
} {
  if (itens.length <= CABEM_NA_BARRA) return { visiveis: itens, extras: [] };

  return {
    visiveis: itens.slice(0, CABEM_NA_BARRA - 1),
    extras: itens.slice(CABEM_NA_BARRA - 1),
  };
}
