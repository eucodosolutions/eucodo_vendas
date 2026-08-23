"use client";

import { useActionState } from "react";

import { mudarStatusDaAssinatura, type EstadoAssinatura } from "./actions";
import { useAviso } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import type { StatusAssinatura } from "@/types/database";

/** O que faz sentido oferecer a partir de cada estado. */
const CAMINHOS: Record<StatusAssinatura, Array<{ status: StatusAssinatura; rotulo: string }>> = {
  pendente: [
    { status: "ativa", rotulo: "Liberar" },
    { status: "cancelada", rotulo: "Recusar" },
  ],
  ativa: [{ status: "suspensa", rotulo: "Suspender" }],
  suspensa: [
    { status: "ativa", rotulo: "Reativar" },
    { status: "cancelada", rotulo: "Cancelar" },
  ],
  cancelada: [{ status: "ativa", rotulo: "Reabrir" }],
};

export function AcoesDaAssinatura({
  assinaturaId,
  status,
}: {
  assinaturaId: string;
  status: StatusAssinatura;
}) {
  const [estado, acao] = useActionState<EstadoAssinatura, FormData>(
    mudarStatusDaAssinatura,
    {},
  );
  useAviso(estado);

  return (
    <div className="flex flex-wrap gap-2">
      {CAMINHOS[status].map((caminho) => (
        <form key={caminho.status} action={acao}>
          <input type="hidden" name="assinaturaId" value={assinaturaId} />
          <input type="hidden" name="status" value={caminho.status} />
          <Botao
            type="submit"
            variante={caminho.status === "ativa" ? "primario" : "secundario"}
            carregandoTexto="Salvando..."
          >
            {caminho.rotulo}
          </Botao>
        </form>
      ))}
    </div>
  );
}
