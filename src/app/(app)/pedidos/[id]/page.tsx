import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AcoesDoPedido } from "./acoes-do-pedido";
import { EtiquetaPagamento, EtiquetaStatus } from "@/components/etiquetas";
import {
  dataHora,
  moeda,
  ROTULO_COR,
  ROTULO_PAGAMENTO,
  ROTULO_TECNOLOGIA,
  whatsappLegivel,
} from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import type { Pedido, PedidoEvento } from "@/types/database";

export const metadata: Metadata = { title: "Pedido" };

const UMA_HORA = 3600;

export default async function PaginaPedido({ params, searchParams }: PageProps<"/pedidos/[id]">) {
  const { id } = await params;
  const { novo, envio } = await searchParams;

  const supabase = await createClient();

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("*")
    .eq("id", id)
    .single<Pedido>();

  if (!pedido) notFound();

  const { data: eventos } = await supabase
    .from("pedido_eventos")
    .select("id, tipo, de, para, detalhe, criado_em")
    .eq("pedido_id", id)
    .order("criado_em", { ascending: false })
    .returns<Array<Pick<PedidoEvento, "id" | "tipo" | "de" | "para" | "detalhe" | "criado_em">>>();

  const previa = pedido.arte_preview_path
    ? (await supabase.storage.from("artes").createSignedUrl(pedido.arte_preview_path, UMA_HORA))
        .data?.signedUrl
    : null;

  const download = pedido.arte_jpg_path
    ? (
        await supabase.storage.from("artes").createSignedUrl(pedido.arte_jpg_path, UMA_HORA, {
          download: `${pedido.codigo}-${pedido.tamanho_codigo}.jpg`,
        })
      ).data?.signedUrl
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/pedidos" className="text-sm font-medium text-marca hover:underline">
          Voltar para os pedidos
        </Link>
      </div>

      {novo ? (
        envio === "link" ? (
          <p className="rounded-lg bg-atencao-suave px-4 py-3 text-sm font-medium text-atencao">
            Pedido criado e arte gerada. Nao ha instancia de WhatsApp conectada, entao use
            &quot;Mandar a arte no WhatsApp&quot; abaixo para abrir a conversa com o texto pronto.
          </p>
        ) : (
          <p className="rounded-lg bg-sucesso-suave px-4 py-3 text-sm font-medium text-sucesso">
            Pedido criado, arte gerada e mensagem enviada para o cliente.
          </p>
        )
      ) : null}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-medium text-tinta-suave">{pedido.codigo}</span>
            <EtiquetaStatus status={pedido.status} />
            <EtiquetaPagamento pagamento={pedido.pagamento} />
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-tinta">
            {pedido.nome_negocio}
          </h1>
          <p className="text-sm text-tinta-suave">
            Aberto em {dataHora(pedido.criado_em)}
            {pedido.origem === "publico" ? ", pelo link publico" : ""}
          </p>
        </div>
        <p className="text-2xl font-semibold text-tinta tabular-nums">
          {moeda(pedido.total_centavos)}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <section className="flex flex-col gap-3 rounded-card border border-borda bg-superficie p-5">
          <h2 className="text-sm font-semibold tracking-wide text-tinta-suave uppercase">Arte</h2>
          {previa ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previa}
                alt={`Arte do display de ${pedido.nome_negocio}`}
                className="w-full rounded-lg border border-borda"
              />
              {download ? (
                <a
                  href={download}
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-marca px-4 text-sm font-medium text-white transition-colors hover:bg-marca-escura"
                >
                  Baixar JPG para impressao
                </a>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-tinta-suave">
              A arte ainda nao foi gerada para este pedido. Use o botao de gerar a arte abaixo.
            </p>
          )}
        </section>

        <div className="flex flex-col gap-6">
          <section className="rounded-card border border-borda bg-superficie p-5">
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-tinta-suave uppercase">
              Dados do pedido
            </h2>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Dado rotulo="WhatsApp" valor={whatsappLegivel(pedido.whatsapp)} />
              <Dado
                rotulo="Modelo"
                valor={`${pedido.tamanho_codigo}, ${ROTULO_COR[pedido.cor].toLowerCase()}, ${ROTULO_TECNOLOGIA[pedido.tecnologia].toLowerCase()}`}
              />
              <Dado rotulo="Quantidade" valor={String(pedido.quantidade)} />
              <Dado rotulo="Valor unitario" valor={moeda(pedido.preco_unitario_centavos)} />
              <Dado
                rotulo="Pagamento"
                valor={
                  pedido.pagamento === "pago" && pedido.forma_pagamento
                    ? `${ROTULO_PAGAMENTO[pedido.forma_pagamento]}, em ${dataHora(pedido.pago_em!)}`
                    : "Aguardando"
                }
              />
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium tracking-wide text-tinta-suave uppercase">
                  Link de avaliacao
                </dt>
                <dd className="mt-0.5 text-sm break-all text-tinta">
                  <a
                    href={pedido.link_avaliacao}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-marca hover:underline"
                  >
                    {pedido.link_avaliacao}
                  </a>
                </dd>
              </div>
              {pedido.observacoes ? (
                <div className="sm:col-span-2">
                  <Dado rotulo="Observacoes" valor={pedido.observacoes} />
                </div>
              ) : null}
              {pedido.motivo_cancelamento ? (
                <div className="sm:col-span-2">
                  <Dado rotulo="Motivo do cancelamento" valor={pedido.motivo_cancelamento} />
                </div>
              ) : null}
            </dl>
          </section>

          <AcoesDoPedido
            pedidoId={pedido.id}
            status={pedido.status}
            pagamento={pedido.pagamento}
            temArte={Boolean(pedido.arte_jpg_path)}
          />

          <section className="rounded-card border border-borda bg-superficie p-5">
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-tinta-suave uppercase">
              Historico
            </h2>
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
                <li className="text-sm text-tinta-suave">Sem movimentacoes ainda.</li>
              ) : null}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-tinta-suave uppercase">{rotulo}</dt>
      <dd className="mt-0.5 text-sm text-tinta">{valor}</dd>
    </div>
  );
}
