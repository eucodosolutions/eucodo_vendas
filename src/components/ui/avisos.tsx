"use client";

import { useEffect, useRef } from "react";
import { toast, Toaster } from "sonner";

/**
 * Todo aviso do sistema sai por aqui.
 *
 * Nada de caixa de erro empurrando o formulario para baixo: no celular, com o
 * cliente esperando, o campo tem que ficar onde estava. O toast avisa e some.
 */
export function Avisos() {
  return (
    <Toaster
      position="top-center"
      duration={4000}
      closeButton
      toastOptions={{
        classNames: {
          toast: "!rounded-lg !border !border-borda !bg-superficie !text-tinta !text-sm",
          description: "!text-tinta-suave",
          actionButton: "!bg-marca !text-white !rounded-md !text-xs !font-medium",
          closeButton: "!bg-superficie !border-borda !text-tinta-suave",
          error: "!border-erro/30 !text-erro",
          success: "!border-sucesso/30 !text-sucesso",
          warning: "!border-atencao/30 !text-atencao",
        },
      }}
    />
  );
}

export const avisar = {
  erro: (mensagem: string) => toast.error(mensagem, { duration: 6000 }),
  sucesso: (mensagem: string) => toast.success(mensagem),
  atencao: (mensagem: string) => toast.warning(mensagem, { duration: 6000 }),
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
