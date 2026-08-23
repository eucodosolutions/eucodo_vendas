"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes } from "react";

import { ALTURA_CONTROLE, juntar } from "./controle";

type BotaoProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variante?: "primario" | "secundario" | "fantasma" | "sucesso";
  /**
   * Diz que a acao esta em curso quando o botao nao consegue descobrir isso
   * sozinho: `type="button"` tocando uma server action pelo `useActionState`,
   * ou submit que mora fora do proprio `<form>` pelo atributo `form`.
   */
  carregando?: boolean;
  carregandoTexto?: string;
  larguraTotal?: boolean;
};

const ESTILOS = {
  primario: "bg-marca text-white hover:bg-marca-escura disabled:bg-marca/50",
  secundario:
    "bg-superficie text-tinta border border-borda-forte hover:border-tinta-suave disabled:opacity-50",
  fantasma: "bg-transparent text-marca hover:bg-marca-suave disabled:opacity-50",
  sucesso: "bg-sucesso text-white hover:opacity-90 disabled:opacity-50",
} as const;

/**
 * Botao de formulario. Dentro de um <form> com server action ele mesmo escuta o
 * envio e trava o duplo clique, que num painel de vendas seria pedido dobrado.
 *
 * Enquanto a acao corre ele mostra a roda girando. So trocar o texto nao era
 * suficiente: quem fecha um pedido espera alguns segundos pela arte e pelo
 * WhatsApp, e um botao apagado com outra frase se le como clique perdido — o
 * vendedor tocava de novo. A roda e a unica coisa que se mexe na tela.
 *
 * Estar carregando implica estar travado; `disabled` continua valendo sozinho,
 * para o botao que ainda nao pode ser tocado, e esse nao ganha roda nenhuma.
 */
export function Botao({
  variante = "primario",
  carregando,
  carregandoTexto,
  larguraTotal,
  children,
  disabled,
  ...props
}: BotaoProps) {
  const { pending } = useFormStatus();
  const emCurso = carregando ?? (pending && props.type !== "button");
  const travado = disabled || emCurso;

  return (
    <button
      {...props}
      disabled={travado}
      className={juntar(
        ALTURA_CONTROLE,
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium whitespace-nowrap transition-colors",
        ESTILOS[variante],
        larguraTotal && "w-full",
      )}
    >
      {emCurso ? <Loader2 size={16} aria-hidden className="animate-spin" /> : null}
      {emCurso && carregandoTexto ? carregandoTexto : children}
    </button>
  );
}
