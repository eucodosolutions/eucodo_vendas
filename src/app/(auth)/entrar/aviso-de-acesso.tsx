"use client";

import { useEffect, useRef } from "react";

import { avisar } from "@/components/ui/avisos";
import { motivoLegivel } from "@/lib/acesso";

/**
 * Traduz o `?erro=` com que o painel devolve quem nao pode entrar.
 *
 * Antes o codigo vinha na URL e morria ali: a pessoa era jogada para o login
 * sem nenhuma explicacao, e ficava tentando de novo achando que errou a senha.
 */
export function AvisoDeAcesso({ codigo }: { codigo?: string }) {
  const jaAvisou = useRef(false);

  useEffect(() => {
    if (jaAvisou.current) return;

    const mensagem = motivoLegivel(codigo);
    if (!mensagem) return;

    jaAvisou.current = true;
    avisar.atencao(mensagem);
  }, [codigo]);

  return null;
}
