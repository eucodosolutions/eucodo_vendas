"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";

import { Campo } from "./campo";
import {
  formatarMascaraWhatsapp,
  MASCARA_WHATSAPP,
  TAMANHO_MASCARA_WHATSAPP,
} from "@/lib/formato";

type CampoWhatsappProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "type" | "value" | "onChange" | "placeholder"
> & {
  rotulo?: string;
  ajuda?: ReactNode;
  erro?: string;
  valorInicial?: string;
};

/**
 * Campo de WhatsApp do sistema, com a mascara (00) 0 0000-0000 sempre ligada.
 *
 * Existe como componente para a mascara nao depender de quem esta escrevendo a
 * tela: numero mal digitado significa arte pronta indo para o contato errado.
 */
export function CampoWhatsapp({
  rotulo = "WhatsApp",
  name = "whatsapp",
  valorInicial = "",
  ajuda,
  ...props
}: CampoWhatsappProps) {
  const [valor, setValor] = useState(() => formatarMascaraWhatsapp(valorInicial));

  return (
    <Campo
      {...props}
      rotulo={rotulo}
      name={name}
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      placeholder={MASCARA_WHATSAPP}
      maxLength={TAMANHO_MASCARA_WHATSAPP}
      value={valor}
      onChange={(evento) => setValor(formatarMascaraWhatsapp(evento.target.value))}
      ajuda={ajuda}
    />
  );
}
