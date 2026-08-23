import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ListaDaEquipe, type VendedorDaLista } from "./lista-da-equipe";
import { sessaoDoPainel } from "@/lib/supabase/painel";
import { createClient } from "@/lib/supabase/server";
import type { Pedido, Perfil } from "@/types/database";

export const metadata: Metadata = { title: "Equipe" };

type LinhaVendedor = Pick<Perfil, "id" | "nome" | "email" | "whatsapp" | "senha_temporaria">;

type LinhaComissao = Pick<
  Pedido,
  "criado_por" | "comissao_centavos" | "comissao_paga_em" | "pagamento" | "status"
>;

type Balanco = { aReceber: number; prevista: number; acertada: number; pedidos: number };

const ZERADO: Balanco = { aReceber: 0, prevista: 0, acertada: 0, pedidos: 0 };

export default async function PaginaEquipe() {
  const sessao = await sessaoDoPainel();
  if (sessao?.perfil.papel !== "assinante") redirect("/vender");

  const supabase = await createClient();

  const [{ data: vendedores }, { data: comissoes }] = await Promise.all([
    supabase
      .from("perfis")
      .select("id, nome, email, whatsapp, senha_temporaria")
      .eq("papel", "vendedor")
      .order("nome")
      .returns<LinhaVendedor[]>(),
    supabase
      .from("pedidos")
      .select("criado_por, comissao_centavos, comissao_paga_em, pagamento, status")
      .gt("comissao_centavos", 0)
      .neq("status", "cancelado")
      .returns<LinhaComissao[]>(),
  ]);

  const balancos = agrupar(comissoes ?? []);

  const equipe: VendedorDaLista[] = (vendedores ?? []).map((vendedor) => ({
    ...vendedor,
    ...(balancos.get(vendedor.id) ?? ZERADO),
  }));

  return <ListaDaEquipe equipe={equipe} />;
}

/**
 * Tres bolsos, e nao um saldo so.
 *
 * "A receber" e o que o vendedor ja ganhou: pedido pago e comissao ainda em
 * aberto. "A caminho" e o pedido fechado que o cliente nao pagou, que ainda
 * pode virar cancelamento. "Acertado" e historico.
 */
function agrupar(linhas: LinhaComissao[]): Map<string, Balanco> {
  const mapa = new Map<string, Balanco>();

  for (const linha of linhas) {
    if (!linha.criado_por) continue;

    const balanco = mapa.get(linha.criado_por) ?? { ...ZERADO };
    balanco.pedidos += 1;

    if (linha.pagamento !== "pago") {
      balanco.prevista += linha.comissao_centavos;
    } else if (linha.comissao_paga_em) {
      balanco.acertada += linha.comissao_centavos;
    } else {
      balanco.aReceber += linha.comissao_centavos;
    }

    mapa.set(linha.criado_por, balanco);
  }

  return mapa;
}
