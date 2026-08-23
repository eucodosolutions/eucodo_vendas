import type { Metadata } from "next";
import Link from "next/link";

import { AcoesDaAssinatura } from "./acoes-da-assinatura";
import { EtiquetaAssinatura } from "@/components/etiquetas";
import { Secao } from "@/components/ui/secao";
import { data, whatsappLegivel } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import type { Assinatura, Perfil, StatusAssinatura } from "@/types/database";

export const metadata: Metadata = { title: "Assinantes" };

type MembroDaConta = Pick<Perfil, "id" | "nome" | "email" | "whatsapp" | "papel" | "status">;

type LinhaAssinatura = Pick<Assinatura, "id" | "nome" | "status" | "criado_em"> & {
  perfis: MembroDaConta[];
};

const FILTROS: Array<{ valor: string; rotulo: string }> = [
  { valor: "todos", rotulo: "Todas" },
  { valor: "pendente", rotulo: "Pendentes" },
  { valor: "ativa", rotulo: "Ativas" },
  { valor: "suspensa", rotulo: "Suspensas" },
  { valor: "cancelada", rotulo: "Canceladas" },
];

export default async function PaginaAssinantes({ searchParams }: PageProps<"/admin/assinantes">) {
  const { status } = await searchParams;
  const filtro = typeof status === "string" ? status : "todos";

  const supabase = await createClient();

  let consulta = supabase
    .from("assinaturas")
    .select("id, nome, status, criado_em, perfis (id, nome, email, whatsapp, papel, status)")
    .order("criado_em", { ascending: false })
    .limit(200);

  if (filtro !== "todos") {
    consulta = consulta.eq("status", filtro as StatusAssinatura);
  }

  const { data: linhas } = await consulta.returns<LinhaAssinatura[]>();
  const contas = linhas ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">Assinantes</h1>
        <p className="mt-1 text-sm text-tinta-suave">
          {contas.length === 0
            ? "Nenhuma conta neste filtro."
            : `${contas.length} conta${contas.length > 1 ? "s" : ""} listada${contas.length > 1 ? "s" : ""}.`}
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        {FILTROS.map((opcao) => {
          const aceso = filtro === opcao.valor;
          return (
            <Link
              key={opcao.valor}
              href={opcao.valor === "todos" ? "/admin/assinantes" : `?status=${opcao.valor}`}
              aria-current={aceso ? "page" : undefined}
              className={`inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition-colors ${
                aceso
                  ? "border-marca bg-marca-suave text-marca"
                  : "border-borda bg-superficie text-tinta-media hover:border-borda-forte"
              }`}
            >
              {opcao.rotulo}
            </Link>
          );
        })}
      </nav>

      {contas.length === 0 ? (
        <div className="rounded-card border border-dashed border-borda-forte bg-superficie p-10 text-center">
          <p className="text-sm text-tinta-suave">
            As contas aparecem aqui assim que alguém se cadastrar pela página.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {contas.map((conta) => {
            const dono = conta.perfis.find((membro) => membro.papel === "assinante");
            const vendedores = conta.perfis.filter((membro) => membro.papel === "vendedor");

            return (
              <Secao key={conta.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-medium text-tinta">{conta.nome}</p>
                      <EtiquetaAssinatura status={conta.status} />
                    </div>

                    <p className="mt-1 text-sm break-all text-tinta-suave">
                      {dono ? `${dono.nome} | ${dono.email}` : "Conta sem dono cadastrado"}
                      {dono?.whatsapp ? ` | ${whatsappLegivel(dono.whatsapp)}` : ""}
                    </p>

                    <p className="mt-1 text-xs text-tinta-suave">
                      Criada em {data(conta.criado_em)}
                      {vendedores.length > 0
                        ? `, ${vendedores.length} vendedor${vendedores.length > 1 ? "es" : ""} na equipe`
                        : ", sem vendedores ainda"}
                    </p>
                  </div>

                  <AcoesDaAssinatura assinaturaId={conta.id} status={conta.status} />
                </div>
              </Secao>
            );
          })}
        </div>
      )}
    </div>
  );
}
