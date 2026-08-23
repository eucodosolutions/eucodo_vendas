/**
 * Por que o painel nao abre, do jeito que a pessoa precisa ouvir.
 *
 * Fica aqui, e nao junto das server actions, porque o codigo tambem viaja na
 * URL: o layout do painel desvia para `/sair?erro=<codigo>` e a tela de login
 * traduz. Modulo de server action so pode exportar funcao assincrona, entao a
 * tabela nao caberia la de qualquer jeito.
 *
 * Nao existe mais `acesso_pendente`: quem espera liberacao e a conta, e o
 * motivo dela e que aparece.
 */
export const MOTIVO_DE_ACESSO: Record<string, string> = {
  acesso_bloqueado: "Este acesso foi bloqueado. Fale com quem cuida da conta.",
  conta_pendente:
    "Sua conta ainda está aguardando liberação. Assim que sair, você recebe um aviso.",
  conta_suspensa: "Esta conta está suspensa. Fale com a Eucodo para reativar.",
  conta_cancelada: "Esta conta foi cancelada.",
};

export function motivoLegivel(codigo: string | undefined): string | null {
  if (!codigo) return null;

  // `hasOwn` antes de indexar: o codigo chega pela URL, e um indice cru acha as
  // chaves herdadas de Object.prototype. `?erro=constructor` devolveria uma
  // funcao, que seguiria para dentro do toast.
  return Object.hasOwn(MOTIVO_DE_ACESSO, codigo) ? MOTIVO_DE_ACESSO[codigo] : null;
}
