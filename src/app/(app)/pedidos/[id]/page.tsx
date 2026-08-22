import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AcoesDoPedido } from "./acoes-do-pedido";
import { AvisoDeChegada } from "./aviso-de-chegada";
import { EtiquetaPagamento, EtiquetaStatus } from "@/components/etiquetas";
import { LinkBotao } from "@/components/ui/link-botao";
import { Dado, Secao } from "@/components/ui/secao";
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

  const { data: pedido } = await supabase.from("pedidos").select("*").eq("id", id).single<Pedido>();

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
    <div className="flex flex-col gap-5">
      {novo ? <AvisoDeChegada envio={typeof envio === "string" ? envio : undefined} /> : null}

      <Link href="/pedidos" className="text-sm font-medium text-marca hover:underline">
        Voltar para os pedidos
      </Link>

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
            {pedido.origem === "publico" ? ", pelo link público" : ""}
          </p>
        </div>
        <p className="text-2xl font-semibold text-tinta tabular-nums">
          {moeda(pedido.total_centavos)}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <Secao titulo="Arte">
          <div className="flex flex-col gap-3">
            {previa ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previa}
                  alt={`Arte do display de ${pedido.nome_negocio}`}
                  className="w-full rounded-lg border border-borda"
                />
                {download ? (
                  <LinkBotao href={download} externo>
                    Baixar JPG para impressão
                  </LinkBotao>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-tinta-suave">
                A arte ainda não foi gerada para este pedido. Use &quot;Gerar a arte&quot; ao lado.
              </p>
            )}
          </div>
        </Secao>

        <div className="flex flex-col gap-5">
          <Secao titulo="Dados do pedido">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Dado rotulo="WhatsApp" valor={whatsappLegivel(pedido.whatsapp)} />
              <Dado
                rotulo="Modelo"
                valor={`${pedido.tamanho_codigo}, ${ROTULO_COR[pedido.cor].toLowerCase()}, ${ROTULO_TECNOLOGIA[pedido.tecnologia].toLowerCase()}`}
              />
              <Dado rotulo="Quantidade" valor={String(pedido.quantidade)} />
              <Dado rotulo="Valor unitário" valor={moeda(pedido.preco_unitario_centavos)} />
              <Dado
                rotulo="Pagamento"
                valor={
                  pedido.pagamento === "pago" && pedido.forma_pagamento
                    ? `${ROTULO_PAGAMENTO[pedido.forma_pagamento]}, em ${dataHora(pedido.pago_em!)}`
                    : "Aguardando"
                }
              />
              <div className="sm:col-span-2">
                <Dado
                  rotulo="Link de avaliação"
                  valor={
                    <a
                      href={pedido.link_avaliacao}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="break-all text-marca hover:underline"
                    >
                      {pedido.link_avaliacao}
                    </a>
                  }
                />
              </div>
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

          <AcoesDoPedido
            pedidoId={pedido.id}
            status={pedido.status}
            pagamento={pedido.pagamento}
            temArte={Boolean(pedido.arte_jpg_path)}
          />

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
      </div>
    </div>
  );
}
