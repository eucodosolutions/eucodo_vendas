"use client";

import { KeyRound } from "lucide-react";
import { useActionState } from "react";

import { gerarNovaSenha, quitarComissoes, type EstadoEquipe } from "./actions";
import { CartaoDeAcesso } from "./cartao-de-acesso";
import { useAviso } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { moeda } from "@/lib/formato";

export function AcoesDoVendedor({
  vendedorId,
  aReceberCentavos,
}: {
  vendedorId: string;
  aReceberCentavos: number;
}) {
  const [estadoSenha, novaSenha] = useActionState<EstadoEquipe, FormData>(gerarNovaSenha, {});
  const [estadoAcerto, acertar] = useActionState<EstadoEquipe, FormData>(quitarComissoes, {});

  useAviso(estadoSenha);
  useAviso(estadoAcerto);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <form action={novaSenha}>
          <input type="hidden" name="vendedorId" value={vendedorId} />
          <Botao type="submit" variante="secundario" carregandoTexto="Gerando...">
            <KeyRound size={16} aria-hidden />
            Nova senha
          </Botao>
        </form>

        {aReceberCentavos > 0 ? (
          <form action={acertar}>
            <input type="hidden" name="vendedorId" value={vendedorId} />
            <Botao type="submit" variante="sucesso" carregandoTexto="Registrando...">
              Acertar {moeda(aReceberCentavos)}
            </Botao>
          </form>
        ) : null}
      </div>

      {estadoSenha.acesso ? <CartaoDeAcesso acesso={estadoSenha.acesso} /> : null}
    </div>
  );
}
