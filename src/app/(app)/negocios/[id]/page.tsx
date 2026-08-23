import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DadosDoNegocio } from "./dados-do-negocio";
import { EtiquetaDeAutor, EtiquetaPagamento, EtiquetaStatus } from "@/components/etiquetas";
import { LinkBotao } from "@/components/ui/link-botao";
import { Secao } from "@/components/ui/secao";
import { dataHora } from "@/lib/formato";
import { sessaoDoPainel } from "@/lib/supabase/painel";
import { createClient } from "@/lib/supabase/server";
import type { Negocio, Pedido, PedidoItem } from "@/types/database";

export const metadata: Metadata = { title: "Negocio" };

type NegocioComAutor = Negocio & { autor: { nome: string } | null };

type LinhaItem = Pick<PedidoItem, "id" | "produto_nome" | "quantidade" | "criado_em"> & {
  pedidos: Pick<Pedido, "id" | "codigo" | "status" | "pagamento"> | null;
};

export default async function PaginaNegocio({ params }: PageProps<"/negocios/[id]">) {
  const { id } = await params;

  const supabase = await createClient();
  const sessao = await sessaoDoPainel();

  const { data: negocio } = await supabase
    .from("negocios")
    .select("*, autor:perfis (nome)")
    .eq("id", id)
    .single<NegocioComAutor>();

  if (!negocio) notFound();

  // O historico vem pelo item, e nao pelo pedido: um pedido pode ter placa
  // deste negocio e placa de outro, e o que interessa aqui e a placa.
  const { data: itens } = await supabase
    .from("pedido_itens")
    .select("id, produto_nome, quantidade, criado_em, pedidos (id, codigo, status, pagamento)")
    .eq("negocio_id", id)
    .order("criado_em", { ascending: false })
    .limit(50)
    .returns<LinhaItem[]>();

  // Quem cadastrou manda no cadastro, e o dono da conta manda em todos. E a
  // mesma regra da policy: repetida aqui so para a tela nao oferecer um botao
  // que o banco vai recusar.
  const daPessoa = Boolean(sessao && negocio.criado_por === sessao.perfil.id);
  const podeEditar = sessao?.perfil.papel === "assinante" || daPessoa;
  const placas = itens ?? [];

  return (
    <div className="flex flex-col gap-5">
      <Link href="/negocios" className="text-sm font-medium text-marca hover:underline">
        Voltar para os negócios
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-tinta">
              {negocio.nome}
            </h1>
            {negocio.criado_por && !daPessoa ? (
              <EtiquetaDeAutor nome={negocio.autor?.nome ?? "alguém da equipe"} />
            ) : null}
          </div>
          {negocio.endereco ? (
            <p className="mt-1 text-sm text-tinta-suave">{negocio.endereco}</p>
          ) : null}
        </div>
        <LinkBotao href="/vender">Vender para este negócio</LinkBotao>
      </header>

      <DadosDoNegocio negocio={negocio} podeEditar={podeEditar} />

      <Secao titulo="Placas deste negócio">
        {placas.length === 0 ? (
          <p className="text-sm text-tinta-suave">
            Nenhuma placa vendida para este negócio ainda.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {placas.map((item) => (
              <li key={item.id}>
                {/* Item sem pedido nao existe: a coluna e obrigatoria e o
                    cascade leva o item junto. O `?` e so para o TypeScript, que
                    trata todo relacionamento do PostgREST como opcional. */}
                <Link
                  href={`/pedidos/${item.pedidos?.id}`}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-borda px-3 py-2.5 transition-colors hover:border-borda-forte"
                >
                  <span className="font-mono text-xs font-medium text-tinta-suave">
                    {item.pedidos?.codigo}
                  </span>
                  <span className="text-sm text-tinta">
                    {item.quantidade}× {item.produto_nome}
                  </span>
                  {item.pedidos ? (
                    <>
                      <EtiquetaStatus status={item.pedidos.status} />
                      <EtiquetaPagamento pagamento={item.pedidos.pagamento} />
                    </>
                  ) : null}
                  <span className="ml-auto text-xs text-tinta-suave tabular-nums">
                    {dataHora(item.criado_em)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </div>
  );
}
