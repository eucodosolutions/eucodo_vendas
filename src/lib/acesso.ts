/**
 * Por que o painel nao abre, do jeito que a pessoa precisa ouvir.
 *
 * Fica aqui, e nao junto das server actions, porque o codigo tambem viaja na
 * URL: o layout do painel desvia para `/entrar?erro=<codigo>` e a tela de login
 * traduz. Modulo de server action so pode exportar funcao assincrona, entao a
 * tabela nao caberia la de qualquer jeito.
 */
export const MOTIVO_DE_ACESSO: Record<string, string> = {
  acesso_pendente: "Seu acesso ainda não foi liberado.",
  acesso_bloqueado: "Este acesso foi bloqueado. Fale com quem cuida da conta.",
  conta_pendente:
    "Sua conta ainda está aguardando liberação. Assim que sair, você recebe um aviso.",
  conta_suspensa: "Esta conta está suspensa. Fale com a Eucodo para reativar.",
  conta_cancelada: "Esta conta foi cancelada.",
};

export function motivoLegivel(codigo: string | undefined): string | null {
  if (!codigo) return null;
  return MOTIVO_DE_ACESSO[codigo] ?? null;
}
