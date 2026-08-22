"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { toast, Toaster } from "sonner";

/**
 * Todo aviso do sistema sai por aqui.
 *
 * Nada de caixa de erro empurrando o formulario para baixo: no celular, com o
 * cliente esperando, o campo tem que ficar onde estava. O toast avisa e some.
 *
 * A cor de cada tom fica em `globals.css`, presa ao `data-type` que o sonner
 * escreve no elemento. Aqui ficam so posicao e comportamento.
 */
export function Avisos() {
  return (
    <Toaster
      position="top-right"
      duration={4000}
      closeButton
      gap={10}
      offset={16}
      // Inline porque o sonner injeta o CSS dele depois da folha do app: como
      // variavel inline vence qualquer regra, o X fica na direita para valer.
      style={
        {
          "--toast-close-button-start": "auto",
          "--toast-close-button-end": "0",
          "--toast-close-button-transform": "translate(35%, -35%)",
        } as CSSProperties
      }
    />
  );
}

export const avisar = {
  sucesso: (mensagem: string) => toast.success(mensagem),
  erro: (mensagem: string) => toast.error(mensagem, { duration: 6000 }),
  atencao: (mensagem: string) => toast.warning(mensagem, { duration: 6000 }),
  info: (mensagem: string) => toast.info(mensagem),
};

/** Resultado que qualquer server action deste sistema devolve. */
export type EstadoComAviso = {
  erro?: string;
  sucesso?: string;
  /** Quando existe, o aviso ganha um botao que abre este endereco. */
  link?: string;
};

/**
 * Transforma o retorno de uma server action em toast.
 *
 * O `useActionState` devolve um objeto novo a cada envio, entao o efeito
 * dispara uma vez por resposta, inclusive quando o mesmo erro se repete.
 */
export function useAviso(estado: EstadoComAviso) {
  const ultimo = useRef<EstadoComAviso | null>(null);

  useEffect(() => {
    if (estado === ultimo.current) return;
    ultimo.current = estado;

    if (estado.erro) {
      avisar.erro(estado.erro);
      return;
    }

    if (!estado.sucesso) return;

    if (estado.link) {
      const destino = estado.link;
      toast.warning(estado.sucesso, {
        duration: 12000,
        action: {
          label: "Abrir WhatsApp",
          onClick: () => window.open(destino, "_blank", "noopener"),
        },
      });
      return;
    }

    avisar.sucesso(estado.sucesso);
  }, [estado]);
}
