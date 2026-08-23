"use client";

import { useEffect, useRef } from "react";

import { avisar } from "@/components/ui/avisos";
import { esvaziarCarrinho } from "@/lib/carrinho/usar-carrinho";

/**
 * Avisa o que aconteceu no pedido recem-criado, e esvazia o carrinho.
 *
 * O redirect da criacao nao consegue disparar toast sozinho, entao quem faz e
 * este componente ao montar. Nao desenha nada na tela.
 *
 * O carrinho e limpo aqui, e nao no botao de fechar pedido, porque este e o
 * unico ponto em que o pedido comprovadamente existe: limpar antes significaria
 * perder o carrinho montado se a gravacao falhasse.
 */
export function AvisoDeChegada({ envio }: { envio?: string }) {
  const jaAvisou = useRef(false);

  useEffect(() => {
    if (jaAvisou.current) return;
    jaAvisou.current = true;

    esvaziarCarrinho();

    if (envio === "nao") {
      // Nao e atencao: o vendedor desligou o aviso de proposito. So lembra por
      // onde a mensagem sai quando ele decidir mandar.
      avisar.sucesso(
        "Pedido criado e artes geradas. O cliente não foi avisado — use Mandar as artes no WhatsApp quando quiser.",
      );
    } else if (envio === "link") {
      avisar.atencao(
        "Pedido criado e artes geradas. Sem instância conectada, use Mandar as artes no WhatsApp.",
      );
    } else {
      avisar.sucesso("Pedido criado, artes geradas e mensagem enviada para o cliente.");
    }
  }, [envio]);

  return null;
}
