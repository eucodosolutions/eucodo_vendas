"use client";

import { KeyRound } from "lucide-react";
import { useActionState, useState } from "react";

import { ModalNovaSenha } from "./modal-nova-senha";
import { quitarComissoes, type EstadoEquipe } from "./actions";
import { Botao } from "@/components/ui/botao";
import { Confirmacao } from "@/components/ui/confirmacao";
import { moeda } from "@/lib/formato";

/**
 * As duas acoes que o dono tem sobre um vendedor, ambas sem volta.
 *
 * Antes eram dois botoes soltos no rodape do cartao, que disparavam na hora.
 * Gerar senha nova invalida a que a pessoa esta usando, e acertar comissao
 * carimba pago o que estava em aberto: um toque errado no celular custava caro.
 */
export function AcoesDoVendedor({
  nome,
  vendedorId,
  aReceberCentavos,
}: {
  nome: string;
  vendedorId: string;
  aReceberCentavos: number;
}) {
  const [estadoAcerto, acertar, acertando] = useActionState<EstadoEquipe, FormData>(
    quitarComissoes,
    {},
  );

  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [rodada, setRodada] = useState(0);
  const [confirmandoAcerto, setConfirmandoAcerto] = useState(false);

  const primeiroNome = nome.split(" ")[0];

  // A `key` nova apaga a senha guardada no popup anterior: sem ela, reabrir
  // "Nova senha" repetiria a de antes e nao ofereceria como gerar outra.
  function fecharTrocaDeSenha() {
    setTrocandoSenha(false);
    setRodada((valor) => valor + 1);
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Botao type="button" variante="secundario" onClick={() => setTrocandoSenha(true)}>
        <KeyRound size={16} aria-hidden />
        Nova senha
      </Botao>

      {aReceberCentavos > 0 ? (
        <Botao type="button" variante="sucesso" onClick={() => setConfirmandoAcerto(true)}>
          Acertar {moeda(aReceberCentavos)}
        </Botao>
      ) : null}

      <ModalNovaSenha
        key={rodada}
        aberto={trocandoSenha}
        aoFechar={fecharTrocaDeSenha}
        nome={nome}
        vendedorId={vendedorId}
      />

      <Confirmacao
        aberto={confirmandoAcerto}
        aoFechar={() => setConfirmandoAcerto(false)}
        titulo={`Acertar ${moeda(aReceberCentavos)} com ${primeiroNome}?`}
        mensagem={`Isto marca como paga a comissão em aberto de ${primeiroNome}. Faça depois de transferir o dinheiro: o registro não volta atrás.`}
        acao={acertar}
        estado={estadoAcerto}
        pendente={acertando}
        confirmarRotulo="Já paguei, registrar"
        carregandoTexto="Registrando..."
        ocultos={{ vendedorId }}
      />
    </div>
  );
}
