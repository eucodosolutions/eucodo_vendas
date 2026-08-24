import type { Metadata } from "next";

import { AlternadorDeVista, type Vista } from "./alternador-de-vista";
import { COLUNAS_DA_LINHA, type LinhaPedido } from "./linha";
import { PedidosInterativos } from "./pedidos-interativos";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { LinkBotao } from "@/components/ui/link-botao";
import { moeda } from "@/lib/formato";
import { sessaoDoPainel } from "@/lib/supabase/painel";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pedidos" };

export default async function PaginaPedidos({ searchParams }: PageProps<"/pedidos">) {
  const { vista: escolhida } = await searchParams;
  const vista: Vista = escolhida === "lista" ? "lista" : "quadro";

  const supabase = await createClient();
  const sessao = await sessaoDoPainel();

  // A RLS ja entrega ao vendedor so os pedidos dele. O papel serve para trocar a
  // conta do cabecalho: o dono quer saber quanto a casa tem a receber, o
  // vendedor quer saber quanto ele tem a receber.
  const ehVendedor = sessao?.perfil.papel === "vendedor";

  // O quadro divide o mesmo bolo em cinco colunas, entao o teto de antes deixava
  // as ultimas quase vazias numa conta movimentada. As colunas de entregue e
  // cancelado ainda cortam o que mostram; quem precisa do historico inteiro vai
  // para a lista.
  const { data } = await supabase
    .from("pedidos")
    .select(COLUNAS_DA_LINHA)
    .order("criado_em", { ascending: false })
    .limit(200)
    .returns<LinhaPedido[]>();

  const pedidos = data ?? [];
  const vivos = pedidos.filter((pedido) => pedido.status !== "cancelado");

  const aReceber = ehVendedor
    ? vivos
        .filter((pedido) => pedido.pagamento === "pago" && !pedido.comissao_paga_em)
        .reduce((soma, pedido) => soma + pedido.comissao_centavos, 0)
    : vivos
        .filter((pedido) => pedido.pagamento === "pendente")
        .reduce((soma, pedido) => soma + pedido.total_centavos, 0);

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoDePagina
        titulo="Pedidos"
        descricao={
          pedidos.length === 0
            ? "Nenhum pedido ainda."
            : `${pedidos.length} pedido${pedidos.length > 1 ? "s" : ""}, ${moeda(aReceber)} ${ehVendedor ? "de comissão " : ""}a receber.`
        }
        acao={
          <div className="flex items-center gap-2">
            {pedidos.length > 0 ? <AlternadorDeVista vista={vista} /> : null}
            <LinkBotao href="/vender">Novo pedido</LinkBotao>
          </div>
        }
      />

      {pedidos.length === 0 ? (
        <EstadoVazio
          mensagem="Os pedidos aparecem aqui assim que a primeira venda for fechada."
          acao={<LinkBotao href="/vender">Fechar a primeira venda</LinkBotao>}
        />
      ) : (
        <PedidosInterativos pedidos={pedidos} vista={vista} ehVendedor={ehVendedor} />
      )}
    </div>
  );
}
