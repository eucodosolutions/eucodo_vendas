"use client";

import { Copy, MessageCircle } from "lucide-react";

import type { Acesso } from "./actions";
import { avisar } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { LinkBotao } from "@/components/ui/link-botao";
import { whatsappLegivel } from "@/lib/formato";

/**
 * O acesso aparece uma vez so.
 *
 * Por isso ele fica na tela como estado, e nao como toast: o dono precisa
 * copiar e mandar antes de sair daqui. Depois que a tela recarrega, a unica
 * saida e gerar outra senha.
 */
export function CartaoDeAcesso({ acesso }: { acesso: Acesso }) {
  const primeiroNome = acesso.nome.split(" ")[0];

  async function copiar() {
    try {
      await navigator.clipboard.writeText(montarTexto(acesso));
      avisar.sucesso("Acesso copiado. Agora é só colar na conversa.");
    } catch {
      avisar.erro("O navegador não deixou copiar. Selecione o texto na mão.");
    }
  }

  return (
    <div className="rounded-card border border-marca/30 bg-marca-suave/40 p-4">
      <p className="text-xs font-semibold tracking-wide text-marca uppercase">
        Acesso de {acesso.nome}
      </p>

      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-tinta-suave">E-mail</dt>
          <dd className="text-sm break-all text-tinta">{acesso.email}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-tinta-suave">Senha provisória</dt>
          <dd className="font-mono text-base font-semibold tracking-wide text-tinta">
            {acesso.senha}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-tinta-suave">
        Esta senha não aparece de novo. No primeiro acesso o sistema exige que{" "}
        {primeiroNome} escolha a dele.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Botao type="button" variante="secundario" onClick={copiar}>
          <Copy size={16} aria-hidden />
          Copiar acesso
        </Botao>

        {acesso.whatsapp ? (
          <LinkBotao
            href={`https://wa.me/${acesso.whatsapp}?text=${encodeURIComponent(montarTexto(acesso))}`}
            variante="sucesso"
            externo
          >
            <MessageCircle size={16} aria-hidden />
            Mandar para {whatsappLegivel(acesso.whatsapp)}
          </LinkBotao>
        ) : null}
      </div>
    </div>
  );
}

function montarTexto(acesso: Acesso): string {
  const entrada =
    typeof window === "undefined" ? null : `Entre em ${window.location.origin}/entrar`;

  return [
    `Olá, ${acesso.nome.split(" ")[0]}! Seu acesso ao Eucodo Vendas está pronto.`,
    "",
    `E-mail: ${acesso.email}`,
    `Senha provisória: ${acesso.senha}`,
    "",
    entrada,
    "No primeiro acesso o sistema pede para você criar a sua senha.",
  ]
    .filter((linha) => linha !== null)
    .join("\n");
}
