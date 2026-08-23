// Envio de WhatsApp do Eucodo Vendas.
//
// Esta funcao existe para o token da uazapi e a chave de servico nunca sairem
// do Supabase. A aplicacao chama daqui com o JWT do vendedor, e quem decide o
// que pode ser enviado e este codigo, nao o navegador.
//
// Quando nao ha instancia conectada (assinante sem instancia, ou que parou de
// pagar), o envio nao falha: a funcao devolve um link formatado do WhatsApp
// para o vendedor abrir e mandar na mao. A venda nunca fica refem da API.
//
// O pedido tem itens, e cada item tem a propria arte. O envio e um texto de
// resumo mais uma imagem por item: o cliente precisa ver a placa de cada
// negocio dele, nao so a primeira.
//
// O PIX copia e cola sai sozinho, na ultima mensagem. Dentro do resumo ele era
// impossivel de copiar no celular: o resumo viaja como legenda da primeira
// arte, e legenda de imagem no WhatsApp nao tem "copiar" — sobrava selecionar
// oitenta caracteres de BR Code com o dedo, no meio de um paragrafo, sem pegar
// nada a mais nem a menos. Mensagem de texto com o codigo e nada mais se copia
// inteira num toque, que e o que o cliente precisa colar no banco dele.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { CABECALHOS_CORS, responder } from "../_shared/cors.ts";

type Corpo = {
  pedidoId: string;
  chave: string;
  /** Texto pronto, para quando o painel quiser mandar algo fora do modelo. */
  textoManual?: string;
  /** Manda so texto, sem a imagem da arte. */
  semArte?: boolean;
};

type Resultado = {
  enviado: boolean;
  via: "uazapi" | "link";
  link?: string;
  texto: string;
  erro?: string;
};

const UMA_HORA = 3600;

Deno.serve(async (requisicao) => {
  if (requisicao.method === "OPTIONS") {
    return new Response("ok", { headers: CABECALHOS_CORS });
  }

  if (requisicao.method !== "POST") {
    return responder({ erro: "Use POST." }, 405);
  }

  const autorizacao = requisicao.headers.get("Authorization") ?? "";
  const jwt = autorizacao.replace(/^Bearer\s+/i, "");
  if (!jwt) return responder({ erro: "Sem credencial." }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser(jwt);
  if (!user) return responder({ erro: "Credencial inválida." }, 401);

  // Aqui roda a chave de servico, que passa por cima do RLS: as duas condicoes
  // que `usuario_ativo()` conferiria no banco precisam ser conferidas na mao.
  const { data: perfil } = await supabase
    .from("perfis")
    .select("ativo, assinaturas (status)")
    .eq("id", user.id)
    .single();

  if (!perfil?.ativo || perfil.assinaturas?.status !== "ativa") {
    return responder({ erro: "Acesso não liberado." }, 403);
  }

  let corpo: Corpo;
  try {
    corpo = await requisicao.json();
  } catch {
    return responder({ erro: "Corpo inválido." }, 400);
  }

  if (!corpo.pedidoId || (!corpo.chave && !corpo.textoManual)) {
    return responder({ erro: "Informe o pedido e o modelo da mensagem." }, 400);
  }

  const { data: pedido } = await supabase
    .from("pedidos")
    .select(
      "id, codigo, assinatura_id, criado_por, total_centavos, prazo_entrega_dias, pix_copia_e_cola, clientes (nome, whatsapp), pedido_itens (ordem, nome_negocio, produto_nome, cor, tecnologia, quantidade, total_centavos, arte_preview_path)",
    )
    .eq("id", corpo.pedidoId)
    .single();

  if (!pedido) return responder({ erro: "Pedido não encontrado." }, 404);
  if (!pedido.clientes) return responder({ erro: "Pedido sem cliente." }, 409);

  const destino = pedido.clientes.whatsapp as string;
  const itens = [...(pedido.pedido_itens ?? [])].sort(
    (a: { ordem: number }, b: { ordem: number }) => a.ordem - b.ordem,
  );

  const montado = corpo.textoManual
    ? { texto: corpo.textoManual, pix: "" }
    : await montarTexto(supabase, corpo.chave, pedido, itens);
  if (!montado) return responder({ erro: "Modelo de mensagem não encontrado." }, 404);

  const { texto, pix } = montado;

  // O que foi dito ao cliente, inteiro. E o que vai no log e no link manual —
  // ali o vendedor manda uma mensagem so, e o codigo precisa estar dentro dela.
  const conversa = pix ? `${texto}\n\n${pix}` : texto;

  const instancia = await instanciaAtiva(supabase, pedido.assinatura_id);
  const linkManual = montarLinkWhatsapp(destino, conversa);

  if (!instancia) {
    await registrar(supabase, {
      pedidoId: pedido.id,
      destino,
      chave: corpo.chave,
      texto: conversa,
      temMidia: false,
      via: "link",
      sucesso: false,
      erro: "Sem instância conectada, enviado por link",
    });

    return responder<Resultado>({ enviado: false, via: "link", link: linkManual, texto: conversa });
  }

  // Uma imagem por item. O texto de resumo viaja com a primeira, e as demais
  // vao so com a legenda do negocio: o cliente recebe uma conversa, nao um
  // bloco de texto repetido.
  const artes = corpo.semArte
    ? []
    : await Promise.all(
        itens
          .filter((item: { arte_preview_path: string | null }) => item.arte_preview_path)
          .map(async (item: { nome_negocio: string; arte_preview_path: string }) => ({
            legenda: item.nome_negocio,
            url:
              (
                await supabase.storage
                  .from("artes")
                  .createSignedUrl(item.arte_preview_path, UMA_HORA)
              ).data?.signedUrl ?? null,
          })),
      );

  const comUrl = artes.filter((arte) => arte.url);

  const envio = await enviarPelaUazapi({
    host: instancia.host,
    token: instancia.token,
    numero: destino,
    texto,
    imagem: comUrl[0]?.url ?? null,
  });

  // As artes seguintes so saem se a primeira mensagem passou: sem isso, uma
  // instancia caida geraria uma fila de falhas identicas no log.
  if (envio.ok) {
    for (const arte of comUrl.slice(1)) {
      await enviarPelaUazapi({
        host: instancia.host,
        token: instancia.token,
        numero: destino,
        texto: arte.legenda,
        imagem: arte.url!,
      });
    }

    // Por ultimo, e sozinho: o codigo fica sendo a mensagem mais recente da
    // conversa, sem imagem junto, e o cliente copia com um toque na hora de
    // pagar. Falhar aqui nao derruba o envio — o resumo ja chegou, e o pedido
    // guarda o copia e cola para o vendedor reenviar.
    if (pix) {
      await enviarPelaUazapi({
        host: instancia.host,
        token: instancia.token,
        numero: destino,
        texto: pix,
        imagem: null,
      });
    }
  }

  await registrar(supabase, {
    pedidoId: pedido.id,
    destino,
    chave: corpo.chave,
    texto: conversa,
    temMidia: comUrl.length > 0,
    via: "uazapi",
    sucesso: envio.ok,
    resposta: envio.resposta,
    erro: envio.erro,
  });

  if (!envio.ok) {
    // A API falhou, mas o vendedor ainda tem como fechar a venda.
    return responder<Resultado>({
      enviado: false,
      via: "link",
      link: linkManual,
      texto: conversa,
      erro: envio.erro,
    });
  }

  return responder<Resultado>({ enviado: true, via: "uazapi", texto: conversa });
});

/**
 * Busca a instancia da instalacao e confirma que ela esta conectada.
 *
 * O token nao esta na tabela: vem cifrado do Vault, por uma funcao que so a
 * chave de servico executa. E o unico lugar do sistema que ve o token em claro.
 */
async function instanciaAtiva(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  assinaturaId: string,
): Promise<{ host: string; token: string } | null> {
  const { data: config } = await supabase
    .from("configuracoes")
    .select("instancia_id")
    .eq("assinatura_id", assinaturaId)
    .single();

  // Conta sem instancia manda por link, ponto. Ate a conexao virar tela de
  // Ajustes esta busca caia em "a primeira instancia ativa que achar" quando a
  // conta nao tinha a sua, o que numa instalacao com um assinante so era
  // conveniencia — e em multiassinatura fazia a mensagem de um sair pelo
  // WhatsApp de outro, com o cliente respondendo para o numero errado.
  if (!config?.instancia_id) return null;

  const { data: cadastro } = await supabase
    .from("instancias_whatsapp")
    .select("id, host")
    .eq("id", config.instancia_id)
    .eq("ativo", true)
    .maybeSingle();

  if (!cadastro) return null;

  const { data: token } = await supabase.rpc("token_da_instancia", {
    p_instancia_id: cadastro.id,
  });

  if (!token) return null;
  const instancia = { host: cadastro.host as string, token: token as string };

  try {
    const resposta = await fetch(`${instancia.host.replace(/\/$/, "")}/instance/status`, {
      headers: { token: instancia.token },
      signal: AbortSignal.timeout(8000),
    });
    if (!resposta.ok) return null;

    const status = await resposta.json();
    const estado = String(
      status?.instance?.status ?? status?.status ?? status?.state ?? "",
    ).toLowerCase();

    // A uazapi responde "connected" quando o aparelho esta pareado.
    return estado.includes("connect") || estado === "open" ? instancia : null;
  } catch {
    return null;
  }
}

async function enviarPelaUazapi({
  host,
  token,
  numero,
  texto,
  imagem,
}: {
  host: string;
  token: string;
  numero: string;
  texto: string;
  imagem: string | null;
}): Promise<{ ok: boolean; resposta?: unknown; erro?: string }> {
  const base = host.replace(/\/$/, "");
  const rota = imagem ? "/send/media" : "/send/text";
  const corpo = imagem
    ? { number: numero, type: "image", file: imagem, text: texto }
    : { number: numero, text: texto, linkPreview: false };

  try {
    const resposta = await fetch(`${base}${rota}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(30000),
    });

    const dados = await resposta.json().catch(() => null);

    if (!resposta.ok) {
      return {
        ok: false,
        resposta: dados,
        erro: `uazapi respondeu ${resposta.status}`,
      };
    }

    return { ok: true, resposta: dados };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "falha de rede" };
  }
}

/**
 * Troca as chaves do modelo pelos dados do pedido.
 *
 * `{itens}` e a lista, uma linha por item. `{nome_negocio}` aponta para o
 * primeiro item e cai no nome do cliente quando o pedido nao tem placa nenhuma,
 * que e justamente o caso de um pedido so de produto padrao.
 *
 * O `{pix}` sai da substituicao e volta separado, porque ele nao e texto: e um
 * BR Code que o cliente precisa copiar inteiro. Quem chama decide se manda numa
 * mensagem so dele — que e o caminho da uazapi — ou se cola no fim do texto,
 * que e o do link manual. Vazio quando o modelo nao pede o codigo ou quando o
 * pedido nao tem cobranca gravada, e ai nada muda.
 */
async function montarTexto(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  chave: string,
  // deno-lint-ignore no-explicit-any
  pedido: any,
  // deno-lint-ignore no-explicit-any
  itens: any[],
): Promise<{ texto: string; pix: string } | null> {
  const { data: modelo } = await supabase
    .from("modelos_mensagem")
    .select("corpo")
    .eq("chave", chave)
    .eq("ativo", true)
    .single();

  if (!modelo) return null;

  const primeiro = itens[0];

  // Cor e tecnologia so existem em placa: num produto padrao as duas sao nulas,
  // e a linha vira o nome do produto puro e simples.
  const lista = itens
    .map((item) => {
      const configuracao = [
        item.produto_nome,
        item.cor ? (item.cor === "branco" ? "branco" : "preto") : null,
        item.tecnologia ? (item.tecnologia === "qr_nfc" ? "QR e aproximação" : "só QR") : null,
      ]
        .filter(Boolean)
        .join(" ");

      const unidades = item.quantidade > 1 ? ` (${item.quantidade} un.)` : "";
      const rotulo = item.nome_negocio ? `${item.nome_negocio}: ${configuracao}` : configuracao;

      return `- ${rotulo}${unidades}, ${formatarMoeda(item.total_centavos)}`;
    })
    .join("\n");

  // Duas consultas a mais so quando o modelo pede a assinatura. Os avisos de
  // status nao pedem, e sao a maioria do que sai daqui.
  const { vendedor, empresa, remetente } = /\{(vendedor|empresa|remetente)\}/.test(modelo.corpo)
    ? await quemAssina(supabase, pedido)
    : { vendedor: "", empresa: "", remetente: "" };

  const valores: Record<string, string> = {
    vendedor,
    empresa,
    remetente,
    cliente: pedido.clientes?.nome ?? "",
    nome_negocio: primeiro?.nome_negocio ?? pedido.clientes?.nome ?? "",
    codigo: pedido.codigo,
    itens: lista,
    produto: primeiro?.produto_nome ?? "",
    cor: primeiro?.cor === "branco" ? "branco" : "preto",
    tecnologia: primeiro?.tecnologia === "qr_nfc" ? "QR code e aproximação" : "QR code",
    quantidade: String(itens.reduce((soma, item) => soma + item.quantidade, 0)),
    total: formatarMoeda(pedido.total_centavos),
    prazo: prazoLegivel(pedido.prazo_entrega_dias),
    // O `{pix}` some do corpo e vira mensagem propria. Fica no mapa mesmo assim
    // para que a chave nao escape do `replace` e apareca escrita no WhatsApp.
    pix: "",
  };

  const texto = modelo.corpo.replace(
    /\{(\w+)\}/g,
    (original: string, chaveDoCampo: string) => valores[chaveDoCampo] ?? original,
  );

  // Montado no fechamento e gravado no pedido, e nao remontado aqui: o codigo
  // carrega o total e o numero daquele pedido, e a chave PIX da conta pode ter
  // mudado desde entao. So o modelo `pedido_criado_pix_agora` pede esta chave.
  const pix = /\{pix\}/.test(modelo.corpo) ? (pedido.pix_copia_e_cola ?? "") : "";

  // O modelo termina no `{pix}`, entao tirar o codigo do corpo deixa linha em
  // branco sobrando no fim da mensagem.
  return { texto: texto.replace(/\s+$/, ""), pix };
}

/**
 * De quem o cliente esta recebendo a mensagem.
 *
 * Os modelos sao da plataforma e valem para toda conta, entao a assinatura nao
 * pode estar escrita neles: ate aqui todo assinante se apresentava ao cliente
 * dele como "a Eucodo Solutions". Quem assina e quem fechou o pedido, e o papel
 * dessa pessoa decide se a empresa entra junto.
 *
 * O assinante e a empresa, entao ele assina com as duas coisas: "Fulano, da
 * Empresa". O vendedor nao — ele indica e ganha comissao, nao trabalha ali.
 * Poe-lo como "da Empresa" seria apresenta-lo ao cliente como funcionario de
 * uma casa que nao e dele, e o cliente passaria a cobrar dele o que e da
 * empresa: prazo, troca, nota. Ele assina so com o proprio nome.
 *
 * `criado_por` e nulo no pedido que entrou pelo link publico, e ai a conta
 * assina sozinha. Nesse caso `{vendedor}` sai vazio de proposito: quem monta a
 * frase inteira e `{remetente}`.
 */
async function quemAssina(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  // deno-lint-ignore no-explicit-any
  pedido: any,
): Promise<{ vendedor: string; empresa: string; remetente: string }> {
  const [{ data: conta }, { data: perfil }] = await Promise.all([
    supabase.from("assinaturas").select("nome").eq("id", pedido.assinatura_id).maybeSingle(),
    pedido.criado_por
      ? supabase.from("perfis").select("nome, papel").eq("id", pedido.criado_por).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const empresa = (conta?.nome ?? "").trim();
  const vendedor = (perfil?.nome ?? "").trim();

  if (vendedor && perfil?.papel === "vendedor") {
    return { vendedor, empresa, remetente: vendedor };
  }

  // Daqui para baixo e o assinante, e a frase precisa continuar de pe com um
  // nome so: conta sem nome, pedido sem autor, ou o assinante que batizou a
  // conta com o proprio nome e nao vai se apresentar duas vezes.
  const remetente = !empresa
    ? vendedor
    : !vendedor || vendedor === empresa
      ? empresa
      : `${vendedor}, da ${empresa}`;

  return { vendedor, empresa, remetente };
}

function prazoLegivel(dias: number | null): string {
  if (!dias) return "combinar";
  return dias === 1 ? "1 dia" : `${dias} dias`;
}

function formatarMoeda(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function montarLinkWhatsapp(numero: string, texto: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

async function registrar(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  dados: {
    pedidoId: string;
    destino: string;
    chave?: string;
    texto: string;
    temMidia: boolean;
    via: "uazapi" | "link";
    sucesso: boolean;
    resposta?: unknown;
    erro?: string;
  },
) {
  await supabase.from("mensagens_whatsapp").insert({
    pedido_id: dados.pedidoId,
    destino: dados.destino,
    chave_modelo: dados.chave ?? null,
    corpo: dados.texto,
    tem_midia: dados.temMidia,
    via: dados.via,
    sucesso: dados.sucesso,
    resposta: dados.resposta ?? null,
    erro: dados.erro ?? null,
  });
}
