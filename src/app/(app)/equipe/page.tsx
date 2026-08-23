import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AcoesDoVendedor } from "./acoes-do-vendedor";
import { NovoVendedor } from "./novo-vendedor";
import { Secao } from "@/components/ui/secao";
import { moeda, whatsappLegivel } from "@/lib/formato";
import { sessaoDoPainel } from "@/lib/supabase/painel";
import { createClient } from "@/lib/supabase/server";
import type { Pedido, Perfil } from "@/types/database";

export const metadata: Metadata = { title: "Equipe" };

type LinhaVendedor = Pick<
  Perfil,
  "id" | "nome" | "email" | "whatsapp" | "status" | "senha_temporaria"
>;

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
      .select("id, nome, email, whatsapp, status, senha_temporaria")
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

  const equipe = vendedores ?? [];
  const balancos = agrupar(comissoes ?? []);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">Equipe</h1>
        <p className="mt-1 text-sm text-tinta-suave">
          {equipe.length === 0
            ? "Nenhum vendedor cadastrado ainda."
            : `${equipe.length} vendedor${equipe.length > 1 ? "es" : ""} na sua equipe.`}
        </p>
      </header>

      <p className="-mt-3 text-sm text-tinta-suave">
        A comissão é definida por produto, em Ajustes: cada produto paga o percentual dele, e o
        valor fica registrado no pedido no dia da venda.
      </p>

      <NovoVendedor />

      {equipe.length === 0 ? null : (
        <div className="flex flex-col gap-3">
          {equipe.map((vendedor) => {
            const balanco = balancos.get(vendedor.id) ?? ZERADO;

            return (
              <Secao key={vendedor.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-base font-medium text-tinta">{vendedor.nome}</p>
                    <p className="text-sm break-all text-tinta-suave">
                      {vendedor.email}
                      {vendedor.whatsapp ? ` | ${whatsappLegivel(vendedor.whatsapp)}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-tinta-suave">
                      {vendedor.senha_temporaria
                        ? "Ainda não trocou a senha provisória."
                        : `${balanco.pedidos} pedido${balanco.pedidos === 1 ? "" : "s"} com comissão`}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="text-xs font-medium tracking-wide text-tinta-suave uppercase">
                      A receber
                    </p>
                    <p className="text-xl font-semibold text-tinta tabular-nums">
                      {moeda(balanco.aReceber)}
                    </p>
                    <p className="text-xs text-tinta-suave tabular-nums">
                      {moeda(balanco.prevista)} a caminho, {moeda(balanco.acertada)} já acertado
                    </p>
                  </div>
                </div>

                <div className="mt-4 border-t border-borda pt-4">
                  <AcoesDoVendedor vendedorId={vendedor.id} aReceberCentavos={balanco.aReceber} />
                </div>
              </Secao>
            );
          })}
        </div>
      )}
    </div>
  );
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
