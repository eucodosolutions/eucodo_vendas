"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { ModalNegocio } from "./modal-negocio";
import { Botao } from "@/components/ui/botao";

/**
 * A ilha de negocio dentro da lista, que e server component.
 *
 * A `key` no popup remonta os campos a cada abertura: sem ela o cadastro
 * seguinte abriria com o negocio que o anterior tinha encontrado no Google.
 */
export function BotaoNovoNegocio({ rotulo = "Novo negócio" }: { rotulo?: string }) {
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

      <ModalNegocio key={rodada} aberto={aberto} aoFechar={fechar} />
    </>
  );
}
