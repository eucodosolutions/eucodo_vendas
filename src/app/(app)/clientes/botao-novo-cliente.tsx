"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { ModalCliente } from "./modal-cliente";
import { Botao } from "@/components/ui/botao";

/**
 * A ilha de cliente dentro da lista, que e server component.
 *
 * A `key` no popup remonta os campos a cada abertura: sao nao controlados, e
 * sem isso o cadastro seguinte abriria com o que sobrou do anterior.
 */
export function BotaoNovoCliente({ rotulo = "Novo cliente" }: { rotulo?: string }) {
  const [aberto, setAberto] = useState(false);
  const [rodada, setRodada] = useState(0);

  function fechar() {
    setAberto(false);
    setRodada((valor) => valor + 1);
  }

  return (
    <>
      <Botao type="button" onClick={() => setAberto(true)}>
        <Plus size={16} aria-hidden />
        {rotulo}
      </Botao>

      <ModalCliente key={rodada} aberto={aberto} aoFechar={fechar} />
    </>
  );
}
