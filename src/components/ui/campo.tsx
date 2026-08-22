"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

import {
  ALTURA_CONTROLE,
  BORDA_ERRO,
  BORDA_NORMAL,
  juntar,
  MOLDURA_CONTROLE,
} from "./controle";

type CampoProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  rotulo: string;
  ajuda?: ReactNode;
  erro?: string;
};

/**
 * Campo de formulario do sistema.
 *
 * Quando o tipo e senha, o botao de mostrar e ocultar vem junto, sem ninguem
 * precisar lembrar de adicionar. Senha digitada as cegas no celular, no meio de
 * uma venda, e erro de digitacao garantido.
 */
export function Campo({ rotulo, ajuda, erro, id, type = "text", ...props }: CampoProps) {
  const gerado = useId();
  const campoId = id ?? props.name ?? gerado;
  const ajudaId = ajuda ? `${campoId}-ajuda` : undefined;
  const erroId = erro ? `${campoId}-erro` : undefined;

  const ehSenha = type === "password";
  const [revelada, setRevelada] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={campoId} className="text-sm font-medium text-tinta">
        {rotulo}
      </label>

      <div className="relative">
        <input
          {...props}
          id={campoId}
          type={ehSenha && revelada ? "text" : type}
          aria-invalid={erro ? true : undefined}
          aria-describedby={[ajudaId, erroId].filter(Boolean).join(" ") || undefined}
          className={juntar(
            MOLDURA_CONTROLE,
            ALTURA_CONTROLE,
            erro ? BORDA_ERRO : BORDA_NORMAL,
            "px-3 placeholder:text-tinta-suave/70",
            ehSenha && "pr-11",
          )}
        />

        {ehSenha ? (
          <button
            type="button"
            onClick={() => setRevelada((atual) => !atual)}
            aria-label={revelada ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={revelada}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-tinta-suave transition-colors hover:text-tinta"
          >
            {revelada ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
          </button>
        ) : null}
      </div>

      {ajuda ? (
        <p id={ajudaId} className="text-xs text-tinta-suave">
          {ajuda}
        </p>
      ) : null}
      {erro ? (
        <p id={erroId} className="text-xs font-medium text-erro">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
