import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { EtiquetaAssinatura, EtiquetaStatus } from "@/components/etiquetas";
import { LinkBotao } from "@/components/ui/link-botao";
import { Secao } from "@/components/ui/secao";
import { data, dataHora, moeda } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import type { Assinatura, Pedido, StatusAssinatura } from "@/types/database";

export const metadata: Metadata = { title: "Dashboard" };

type LinhaAssinatura = Pick<Assinatura, "id" | "nome" | "status" | "criado_em">;
type LinhaPedido = Pick<
  Pedido,
  "id" | "codigo" | "assinatura_id" | "total_centavos" | "status" | "criado_em"
>;

export default async function PaginaDashboard() {
  const supabase = await createClient();

  const agora = new Date();
  const inicioDoMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const inicioDoMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);

  const [{ data: assinaturas }, { data: doPeriodo }, { data: recentes }] = await Promise.all([
    supabase
      .from("assinaturas")
      .select("id, nome, status, criado_em")
      .order("criado_em", { ascending: false })
      .limit(500)
      .returns<LinhaAssinatura[]>(),
    supabase
      .from("pedidos")
      .select("id, codigo, assinatura_id, total_centavos, status, criado_em")
      .gte("criado_em", inicioDoMesAnterior.toISOString())
      .neq("status", "cancelado")
      .returns<LinhaPedido[]>(),
    supabase
      .from("pedidos")
      .select("id, codigo, assinatura_id, total_centavos, status, criado_em")
      .order("criado_em", { ascending: false })
      .limit(6)
      .returns<LinhaPedido[]>(),
  ]);

  const contas = assinaturas ?? [];
  const nomeDaConta = new Map(contas.map((conta) => [conta.id, conta.nome]));

  const porStatus = contar(contas);
  const mes = fecharMes(doPeriodo ?? [], inicioDoMes);
  const anterior = fecharMes(doPeriodo ?? [], inicioDoMesAnterior, inicioDoMes);

  const ranking = ordenarPorVolume(doPeriodo ?? [], inicioDoMes, nomeDaConta);
  const pendentes = contas.filter((conta) => conta.status === "pendente");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-tinta">Dashboard</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            A plataforma inteira, do mês corrente.
          </p>
        </div>
        <LinkBotao href="/admin/assinantes" variante="secundario">
          Ver assinantes
        </LinkBotao>
      </header>

      {pendentes.length > 0 ? (
        <Secao>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-base font-medium text-tinta">
                {pendentes.length === 1
                  ? "Uma conta esperando liberação"
                  : `${pendentes.length} contas esperando liberação`}
              </p>
              <p className="mt-0.5 text-sm text-tinta-suave">
                {pendentes
                  .slice(0, 3)
                  .map((conta) => conta.nome)
                  .join(", ")}
                {pendentes.length > 3 ? ` e mais ${pendentes.length - 3}` : ""}
              </p>
            </div>
            <LinkBotao href="/admin/assinantes?status=pendente">Liberar acesso</LinkBotao>
          </div>
        </Secao>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Numero rotulo="Assinantes ativos" valor={String(porStatus.ativa)} />
        <Numero
          rotulo="Esperando liberação"
          valor={String(porStatus.pendente)}
          nota={`${porStatus.suspensa} suspensa${porStatus.suspensa === 1 ? "" : "s"}`}
        />
        <Numero
          rotulo="Pedidos no mês"
          valor={String(mes.pedidos)}
          delta={<Delta atual={mes.pedidos} anterior={anterior.pedidos} />}
        />
        <Numero
          rotulo="Valor no mês"
          valor={moeda(mes.valor)}
          delta={<Delta atual={mes.valor} anterior={anterior.valor} />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Quem mais vendeu no mês">
          {ranking.length === 0 ? (
            <Vazio texto="Nenhum pedido fechado neste mês ainda." />
          ) : (
            <ol className="flex flex-col gap-3">
              {ranking.map((linha, posicao) => (
                <li key={linha.id} className="flex items-center gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-papel text-xs font-semibold text-tinta-media tabular-nums">
                    {posicao + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-tinta">{linha.nome}</span>
                  <span className="shrink-0 text-sm text-tinta-suave tabular-nums">
                    {linha.pedidos} ped.
                  </span>
                  <span className="shrink-0 text-sm font-medium text-tinta tabular-nums">
                    {moeda(linha.valor)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Secao>

        <Secao titulo="Últimos cadastros">
          {contas.length === 0 ? (
            <Vazio texto="Nenhuma conta criada ainda." />
          ) : (
            <ul className="flex flex-col gap-3">
              {contas.slice(0, 6).map((conta) => (
                <li key={conta.id} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm text-tinta">{conta.nome}</span>
                  <EtiquetaAssinatura status={conta.status} />
                  <span className="shrink-0 text-xs text-tinta-suave tabular-nums">
                    {data(conta.criado_em)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Secao>
      </div>

      <Secao titulo="Últimos pedidos">
        {(recentes ?? []).length === 0 ? (
          <Vazio texto="Nenhum pedido na plataforma ainda." />
        ) : (
          <ul className="flex flex-col gap-3">
            {(recentes ?? []).map((pedido) => (
              <li key={pedido.id} className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs font-medium text-tinta-suave">
                  {pedido.codigo}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-tinta">
                  {nomeDaConta.get(pedido.assinatura_id) ?? "Conta removida"}
                </span>
                <EtiquetaStatus status={pedido.status} />
                <span className="shrink-0 text-sm font-medium text-tinta tabular-nums">
                  {moeda(pedido.total_centavos)}
                </span>
                <span className="shrink-0 text-xs text-tinta-suave tabular-nums">
                  {dataHora(pedido.criado_em)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <p className="text-xs text-tinta-suave">
        <Link href="/admin/assinantes" className="font-medium text-marca hover:underline">
          Assinantes
        </Link>{" "}
        é onde o status de cada conta muda.
      </p>
    </div>
  );
}

/**
 * Cartao de numero.
 *
 * O valor nao usa `tabular-nums`: em corpo grande, dar a todo digito a largura
 * do zero deixa o numero frouxo. Alinhamento tabular fica para as colunas, onde
 * ele serve para alguma coisa.
 */
function Numero({
  rotulo,
  valor,
  nota,
  delta,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  delta?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-borda bg-superficie p-4">
      <p className="text-xs font-medium tracking-wide text-tinta-suave uppercase">{rotulo}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-tinta">{valor}</p>
      {delta ?? (nota ? <p className="mt-1 text-xs text-tinta-suave">{nota}</p> : null)}
    </div>
  );
}

/** Variacao contra o mes anterior, sempre com o periodo dito por extenso. */
function Delta({ atual, anterior }: { atual: number; anterior: number }) {
  if (anterior === 0) {
    return (
      <p className="mt-1 text-xs text-tinta-suave">
        {atual === 0 ? "Sem movimento no mês passado" : "Primeiro mês com movimento"}
      </p>
    );
  }

  const variacao = Math.round(((atual - anterior) / anterior) * 100);
  const Icone = variacao > 0 ? ArrowUpRight : variacao < 0 ? ArrowDownRight : Minus;
  const cor = variacao > 0 ? "text-sucesso" : variacao < 0 ? "text-erro" : "text-tinta-suave";

  return (
    <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${cor}`}>
      <Icone size={13} aria-hidden />
      {variacao > 0 ? "+" : ""}
      {variacao}% contra o mês passado
    </p>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="text-sm text-tinta-suave">{texto}</p>;
}

function contar(contas: LinhaAssinatura[]): Record<StatusAssinatura, number> {
  const zerado: Record<StatusAssinatura, number> = {
    pendente: 0,
    ativa: 0,
    suspensa: 0,
    cancelada: 0,
  };

  for (const conta of contas) zerado[conta.status] += 1;
  return zerado;
}

function fecharMes(pedidos: LinhaPedido[], de: Date, ate?: Date) {
  const dentro = pedidos.filter((pedido) => {
    const quando = new Date(pedido.criado_em);
    return quando >= de && (!ate || quando < ate);
  });

  return {
    pedidos: dentro.length,
    valor: dentro.reduce((soma, pedido) => soma + pedido.total_centavos, 0),
  };
}

function ordenarPorVolume(
  pedidos: LinhaPedido[],
  desde: Date,
  nomes: Map<string, string>,
): Array<{ id: string; nome: string; pedidos: number; valor: number }> {
  const mapa = new Map<string, { pedidos: number; valor: number }>();

  for (const pedido of pedidos) {
    if (new Date(pedido.criado_em) < desde) continue;

    const linha = mapa.get(pedido.assinatura_id) ?? { pedidos: 0, valor: 0 };
    linha.pedidos += 1;
    linha.valor += pedido.total_centavos;
    mapa.set(pedido.assinatura_id, linha);
  }

  return [...mapa.entries()]
    .map(([id, linha]) => ({ id, nome: nomes.get(id) ?? "Conta removida", ...linha }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);
}
