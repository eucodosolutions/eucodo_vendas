"use client";

import { useEffect, useRef } from "react";

import { avisar } from "@/components/ui/avisos";

/**
 * Avisa o que aconteceu no pedido recem-criado.
 *
 * O redirect da criacao nao consegue disparar toast sozinho, entao quem faz e
 * este componente ao montar. Nao desenha nada na tela.
 */
export function AvisoDeChegada({ envio }: { envio?: string }) {
  const jaAvisou = useRef(false);

  useEffect(() => {
    if (jaAvisou.current) return;
    jaAvisou.current = true;

    if (envio === "link") {
      avisar.atencao(
        "Pedido criado e arte gerada. Sem instância conectada, use Mandar a arte no WhatsApp.",
      );
    } else {
      avisar.sucesso("Pedido criado, arte gerada e mensagem enviada para o cliente.");
    }
  }, [envio]);

  return null;
}
