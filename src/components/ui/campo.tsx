"use client";

import { Eye, EyeOff } from "lucide-react";
import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type TextareaHTMLAttributes,
} from "react";

import {
  ALTURA_CONTROLE,
  BORDA_ERRO,
  BORDA_NORMAL,
  juntar,
  MOLDURA_CONTROLE,
} from "./controle";

type CampoProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  rotulo: string;
  /** Obrigatório: todo campo do sistema mostra um exemplo do que se espera. */
  placeholder: string;
  ajuda?: ReactNode;
  erro?: string;
  /**
   * Valor que a tela decidiu, e nao a pessoa: da para ler e copiar, nao editar.
   *
   * E o caso das medidas de A6 e A5 no cadastro de produto. Sai `readOnly` e
   * nao `disabled` de proposito: campo desabilitado nao viaja no formulario, e
   * a medida precisa chegar ao servidor.
   */
  bloqueado?: boolean;
  /** Para quem precisa devolver o foco ao campo, como o carrinho da venda. */
  ref?: Ref<HTMLInputElement>;
};

/**
 * Campo de formulario do sistema.
 *
 * Duas coisas o proprio componente garante, para nao depender de lembranca de
 * quem escreve a tela: senha sempre vem com o botao de mostrar e ocultar, e
 * todo campo pede placeholder. Senha digitada as cegas no celular, no meio de
 * uma venda, e erro de digitacao garantido.
 */
export function Campo({
  rotulo,
  ajuda,
  erro,
  bloqueado,
  id,
  ref,
  type = "text",
  ...props
}: CampoProps) {
  const gerado = useId();
  const campoId = id ?? props.name ?? gerado;
  const ajudaId = ajuda ? `${campoId}-ajuda` : undefined;
  const erroId = erro ? `${campoId}-erro` : undefined;

  const ehSenha = type === "password";
  const [revelada, setRevelada] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={campoId} className="text-rotulo font-medium text-tinta">
        {rotulo}
      </label>

      <div className="relative">
        <input
          {...props}
          ref={ref}
          id={campoId}
          type={ehSenha && revelada ? "text" : type}
          readOnly={bloqueado || props.readOnly}
          aria-invalid={erro ? true : undefined}
          aria-describedby={[ajudaId, erroId].filter(Boolean).join(" ") || undefined}
          className={juntar(
            MOLDURA_CONTROLE,
            ALTURA_CONTROLE,
            erro ? BORDA_ERRO : BORDA_NORMAL,
            "px-3 placeholder:text-tinta-suave/70",
            bloqueado && "bg-papel text-tinta-media",
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

type CampoTextoProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
  rotulo: string;
  placeholder: string;
  ajuda?: ReactNode;
  erro?: string;
};

/**
 * Campo de varias linhas, com a mesma moldura do `Campo`.
 *
 * Existe por causa da descricao do produto, que e o texto que o cliente le para
 * entender o que esta comprando: cabe mal numa linha so.
 */
export function CampoTexto({ rotulo, ajuda, erro, id, rows = 3, ...props }: CampoTextoProps) {
  const gerado = useId();
  const campoId = id ?? props.name ?? gerado;
  const ajudaId = ajuda ? `${campoId}-ajuda` : undefined;
  const erroId = erro ? `${campoId}-erro` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={campoId} className="text-rotulo font-medium text-tinta">
        {rotulo}
      </label>

      <textarea
        {...props}
        id={campoId}
        rows={rows}
        aria-invalid={erro ? true : undefined}
        aria-describedby={[ajudaId, erroId].filter(Boolean).join(" ") || undefined}
        className={juntar(
          MOLDURA_CONTROLE,
          erro ? BORDA_ERRO : BORDA_NORMAL,
          "resize-y px-3 py-2 placeholder:text-tinta-suave/70",
        )}
      />

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
