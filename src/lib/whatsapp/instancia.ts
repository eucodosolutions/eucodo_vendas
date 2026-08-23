"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Os quatro estados da uazapi, mais o nosso.
 *
 * `sem_instancia` e a conta que nunca pediu para conectar, e e o unico que a
 * tela trata como comeco de conversa. `hibernado` e sessao pausada com as
 * credenciais guardadas: para quem esta olhando a tela, e o mesmo que caido.
 */
export type EstadoDaConexao =
  | "sem_instancia"
  | "desconectado"
  | "conectando"
  | "conectado"
  | "hibernado";

export type Conexao = {
  estado: EstadoDaConexao;
  numero?: string | null;
  perfil?: string | null;
  /** Ja vem no formato data:image/png;base64, pronto para o <img>. */
  qrcode?: string | null;
  paircode?: string | null;
  erro?: string;
};

/**
 * Como esta o WhatsApp da conta.
 *
 * A aplicacao nao conhece o admintoken da uazapi nem a chave de servico: manda
 * o JWT de quem esta logado e a Edge Function decide. Mesmo desenho do envio e
 * da busca no Google, pelo mesmo motivo — o admintoken abre o servidor inteiro.
 */
export async function verConexao(): Promise<Conexao> {
  return await pedir({ acao: "status" });
}

/**
 * Pede uma conexao nova e devolve o QR code para escanear.
 *
 * Na primeira vez a instancia nem existe: e a Edge Function que a cria no
 * servidor da plataforma antes de gerar o codigo. Da segunda em diante, e a
 * mesma instancia pedindo outro QR — o anterior vale dois minutos.
 *
 * Com `telefone`, a uazapi devolve um codigo de pareamento em vez do QR, que e
 * o caminho de quem esta conectando pelo celular e nao tem uma segunda tela
 * para apontar a camera.
 */
export async function conectarWhatsapp(telefone?: string): Promise<Conexao> {
  return await pedir({ acao: "conectar", telefone });
}

/** Solta o aparelho pareado. A instancia continua de pe, esperando outro QR. */
export async function desconectarWhatsapp(): Promise<Conexao> {
  return await pedir({ acao: "desconectar" });
}

const PADRAO = "Não consegui falar com o servidor de WhatsApp.";

async function pedir(corpo: Record<string, unknown>): Promise<Conexao> {
  const supabase = await createClient();

  const { data, error } = await supabase.functions.invoke<Conexao>("whatsapp-instancia", {
    body: corpo,
  });

  if (error) return { estado: "sem_instancia", erro: await motivo(error) };
  if (!data) return { estado: "sem_instancia", erro: PADRAO };

  return data;
}

/**
 * Tira da falha o que a funcao tem a dizer.
 *
 * `functions.invoke` transforma qualquer resposta fora do 2xx em erro e guarda
 * a resposta original no `context`. Sem abrir esse envelope, "conta sem acesso",
 * "servidor no limite de instancias" e "a uazapi nao respondeu" chegariam na
 * tela como a mesma frase, e cada uma pede uma providencia diferente.
 */
async function motivo(error: unknown): Promise<string> {
  const resposta = (error as { context?: unknown }).context;
  if (!(resposta instanceof Response)) return PADRAO;

  try {
    const corpo = (await resposta.clone().json()) as { erro?: unknown };
    console.error("whatsapp-instancia:", resposta.status, corpo);
    return typeof corpo.erro === "string" ? corpo.erro : PADRAO;
  } catch {
    console.error("whatsapp-instancia:", resposta.status, await resposta.clone().text());
    return PADRAO;
  }
}
