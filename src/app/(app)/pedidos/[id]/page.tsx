import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AcoesDoPedido } from "./acoes-do-pedido";
import { AvisoDeChegada } from "./aviso-de-chegada";
import { EtiquetaPagamento, EtiquetaStatus } from "@/components/etiquetas";
import { LinkBotao } from "@/components/ui/link-botao";
import { Dado, Secao } from "@/components/ui/secao";
import {
  apelidoDeArquivo,
  dataHora,
  moeda,
  ROTULO_COR,
  ROTULO_PAGAMENTO,
  ROTULO_TECNOLOGIA,
  whatsappLegivel,
} from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import type { Cliente, Pedido, PedidoEvento, PedidoItem } from "@/types/database";

export const metadata: Metadata = { title: "Pedido" };

const UMA_HORA = 3600;

type PedidoCompleto = Pedido & {
  clientes: Pick<Cliente, "id" | "nome" | "whatsapp"> | null;
  pedido_itens: PedidoItem[];
};

/** O item ja com as URLs assinadas dos arquivos dele. */
type ItemComArte = PedidoItem & { previa: string | null; download: string | null };

export default async function PaginaPedido({ params, searchParams }: PageProps<"/pedidos/[id]">) {
  const { id } = await params;
  const { novo, envio } = await searchParams;

  const supabase = await createClient();

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("*, clientes (id, nome, whatsapp), pedido_itens (*)")
    .eq("id", id)
    .single<PedidoCompleto>();

  if (!pedido) notFound();

  const itens = [...pedido.pedido_itens].sort((a, b) => a.ordem - b.ordem);

  const { data: eventos } = await supabase
    .from("pedido_eventos")
    .select("id, tipo, de, para, detalhe, criado_em")
    .eq("pedido_id", id)
    .order("criado_em", { ascending: false })
    .returns<Array<Pick<PedidoEvento, "id" | "tipo" | "de" | "para" | "detalhe" | "criado_em">>>();

  const comArte: ItemComArte[] = await Promise.all(
    itens.map(async (item) => ({
      ...item,
      previa: item.arte_preview_path
        ? ((
            await supabase.storage.from("artes").createSignedUrl(item.arte_preview_path, UMA_HORA)
          ).data?.signedUrl ?? null)
        : null,
      download: item.arte_jpg_path
        ? ((
            await supabase.storage.from("artes").createSignedUrl(item.arte_jpg_path, UMA_HORA, {
              download: `${pedido.codigo}-${item.ordem}-${apelidoDeArquivo(item.produto_nome)}.jpg`,
            })
          ).data?.signedUrl ?? null)
        : null,
      })),
  );

  const pecas = itens.reduce((soma, item) => soma + item.quantidade, 0);
  const faltaArte = itens.some((item) => !item.arte_jpg_path);

  return (
    <div className="flex flex-col gap-5">
      {novo ? <AvisoDeChegada envio={typeof envio === "string" ? envio : undefined} /> : null}

      <Link href="/pedidos" className="text-sm font-medium text-marca hover:underline">
        Voltar para os pedidos
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-medium text-tinta-suave">{pedido.codigo}</span>
            <EtiquetaStatus status={pedido.status} />
            <EtiquetaPagamento pagamento={pedido.pagamento} />
          </div>

          <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-tinta">
            {pedido.clientes ? (
              <Link href={`/clientes/${pedido.clientes.id}`} className="hover:underline">
                {pedido.clientes.nome}
              </Link>
            ) : (
              "Cliente removido"
            )}
          </h1>

          <p className="text-sm text-tinta-suave">
            {itens.length} {itens.length === 1 ? "item" : "itens"}, {pecas}{" "}
            {pecas === 1 ? "peça" : "peças"}, aberto em {dataHora(pedido.criado_em)}
            {pedido.origem === "publico" ? ", pelo link público" : ""}
          </p>

          <p className="text-sm text-tinta-suave">
            Prazo de entrega: {pedido.prazo_entrega_dias}{" "}
            {pedido.prazo_entrega_dias === 1 ? "dia" : "dias"}
          </p>
        </div>

        <p className="text-2xl font-semibold text-tinta tabular-nums">
          {moeda(pedido.total_centavos)}
        </p>
      </header>

      <Secao titulo={itens.length === 1 ? "O item deste pedido" : "Os itens deste pedido"}>
        <ul className="flex flex-col gap-5">
          {comArte.map((item) => (
            <li
              key={item.id}
              className={
                item.tipo === "avaliacao"
                  ? "grid gap-4 border-b border-borda pb-5 last:border-0 last:pb-0 sm:grid-cols-[200px_1fr]"
                  : "border-b border-borda pb-5 last:border-0 last:pb-0"
              }
            >
              {item.tipo === "avaliacao" ? (
                <div className="flex flex-col gap-2">
                  {item.previa ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.previa}
                        alt={`Arte do display de ${item.nome_negocio}`}
                        className="w-full rounded-lg border border-borda"
                      />
                      {item.download ? (
                        <LinkBotao href={item.download} variante="secundario" externo>
                          Baixar JPG
                        </LinkBotao>
                      ) : null}
                    </>
                  ) : (
                    <div className="rounded-lg border border-dashed border-borda-forte p-6 text-center">
                      <p className="text-xs text-tinta-suave">Arte ainda não gerada</p>
                    </div>
                  )}
                </div>
              ) : null}

              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {item.nome_negocio ? (
                  <div className="sm:col-span-2">
                    <Dado rotulo="Negócio impresso na placa" valor={item.nome_negocio} />
                  </div>
                ) : null}
                <Dado rotulo="Produto" valor={modeloDoItem(item)} />
                <Dado rotulo="Quantidade" valor={String(item.quantidade)} />
                <Dado rotulo="Valor unitário" valor={moeda(item.preco_unitario_centavos)} />
                <Dado rotulo="Subtotal" valor={moeda(item.total_centavos)} />
                {item.link_avaliacao ? (
                  <div className="sm:col-span-2">
                    <Dado
                      rotulo="Link de avaliação"
                      valor={
                        <a
                          href={item.link_avaliacao}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="break-all text-marca hover:underline"
                        >
                          {item.link_avaliacao}
                        </a>
                      }
                    />
                  </div>
                ) : null}
              </dl>
            </li>
          ))}
        </ul>
      </Secao>

      <div className="grid gap-5 lg:grid-cols-2">
        <Secao titulo="Dados do pedido">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Dado
              rotulo="WhatsApp do cliente"
              valor={pedido.clientes ? whatsappLegivel(pedido.clientes.whatsapp) : "Sem cliente"}
            />
            <Dado
              rotulo="Pagamento"
              valor={
                pedido.pagamento === "pago" && pedido.forma_pagamento
                  ? `${ROTULO_PAGAMENTO[pedido.forma_pagamento]}, em ${dataHora(pedido.pago_em!)}`
                  : "Aguardando"
              }
            />
            {pedido.comissao_centavos > 0 ? (
              <Dado
                rotulo="Comissão"
                valor={`${moeda(pedido.comissao_centavos)}${
                  pedido.comissao_paga_em ? ", já acertada" : ""
                }`}
              />
            ) : null}
            {pedido.observacoes ? (
              <div className="sm:col-span-2">
                <Dado rotulo="Observações" valor={pedido.observacoes} />
              </div>
            ) : null}
            {pedido.motivo_cancelamento ? (
              <div className="sm:col-span-2">
                <Dado rotulo="Motivo do cancelamento" valor={pedido.motivo_cancelamento} />
              </div>
            ) : null}
          </dl>
        </Secao>

        <Secao titulo="Histórico">
          <ol className="flex flex-col gap-3">
            {(eventos ?? []).map((evento) => (
              <li key={evento.id} className="flex gap-3 text-sm">
                <span className="shrink-0 text-tinta-suave tabular-nums">
                  {dataHora(evento.criado_em)}
                </span>
                <span className="text-tinta">
                  {evento.detalhe ??
                    (evento.de ? `${evento.de} para ${evento.para}` : evento.para)}
                </span>
              </li>
            ))}
            {(eventos ?? []).length === 0 ? (
              <li className="text-sm text-tinta-suave">Sem movimentações ainda.</li>
            ) : null}
          </ol>
        </Secao>
      </div>

      <AcoesDoPedido
        pedidoId={pedido.id}
        status={pedido.status}
        pagamento={pedido.pagamento}
        faltaArte={faltaArte}
      />
    </div>
  );
}

/**
 * Como o item se descreve: nome do produto e, so na placa, cor e tecnologia.
 *
 * Produto padrao nao tem esses dois eixos, e escrever "camiseta, , " seria pior
 * que nao escrever nada.
 */
function modeloDoItem(item: PedidoItem): string {
  return [
    item.produto_nome,
    item.cor ? ROTULO_COR[item.cor].toLowerCase() : null,
    item.tecnologia ? ROTULO_TECNOLOGIA[item.tecnologia].toLowerCase() : null,
  ]
    .filter(Boolean)
    .join(", ");
}
