"use client";

import { Check, Download, ExternalLink, FileCode2, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

import type { ModeloDoGerador } from "./modelo";
import {
  entradaDosParametros,
  LIMITES,
  LINK_PADRAO,
  NEGOCIO_PADRAO,
  nomeDoArquivo,
  paraQuery,
  specDosParametros,
  type ParametrosDaArte,
} from "./parametros";
import {
  BuscaDeNegocio,
  type NegocioCadastrado,
  type NegocioEscolhido,
} from "@/components/ui/busca-de-negocio";
import { Campo } from "@/components/ui/campo";
import { Escolha } from "@/components/ui/escolha";
import { Interruptor } from "@/components/ui/interruptor";
import { LinkBotao } from "@/components/ui/link-botao";
import { Secao } from "@/components/ui/secao";
import { Selecao } from "@/components/ui/selecao";
import { buildDisplaySvg } from "@/lib/art/template";
import { THEMES } from "@/lib/art/theme";
import { pixelSize } from "@/lib/art/types";
import { cantoDaPrevia } from "@/lib/art/vitrine";
import {
  ACABAMENTO_PADRAO,
  CORES,
  TAMANHOS,
  tamanhoDasMedidas,
  TECNOLOGIAS,
  type TamanhoDePlaca,
} from "@/lib/catalogo";
import { ROTULO_COR, ROTULO_TECNOLOGIA, validarLinkAvaliacao } from "@/lib/formato";
import type { CorArte, TecnologiaArte } from "@/types/database";

/**
 * A bancada da arte: nome, link, cor e modelo de um lado, a peca do outro.
 *
 * O desenho acontece no navegador, e nao no servidor como na vitrine de
 * `/vender`. Aqui a peca muda a cada letra digitada, e uma ida ao servidor por
 * tecla seria latencia no lugar exato onde a tela serve para alguma coisa. O
 * motor de arte e TS puro — quem depende de Node e so a rasterizacao, e ela
 * fica no download.
 *
 * Nada daqui grava: sem pedido, sem cliente, sem Storage e sem WhatsApp.
 */
export function GeradorDeArte({
  modelos,
  negocios,
}: {
  modelos: ModeloDoGerador[];
  negocios: NegocioCadastrado[];
}) {
  const primeiro = modelos[0] ?? null;
  const inicial = medidasDoModelo(primeiro);

  const [modeloId, setModeloId] = useState(primeiro?.id ?? "");
  const [negocio, setNegocio] = useState<NegocioEscolhido | null>(null);
  const [nome, setNome] = useState("");
  const [link, setLink] = useState("");
  const [cor, setCor] = useState<CorArte>(primeiro?.produto_avaliacao.cores[0] ?? "branco");
  const [tec, setTec] = useState<TecnologiaArte>(primeiro?.produto_avaliacao.tecnologia ?? "qr_nfc");

  // Sem catalogo a tela ja abre destravada: nao ha modelo para copiar medida.
  const [livre, setLivre] = useState(modelos.length === 0);
  const [margemVisivel, setMargemVisivel] = useState(false);

  const [tamanho, setTamanho] = useState<TamanhoDePlaca>(
    tamanhoDasMedidas(inicial.larguraMm, inicial.alturaMm),
  );
  const [medidas, setMedidas] = useState<Medidas>(inicial);

  const rotulo = modelos.find((modelo) => modelo.id === modeloId)?.nome ?? rotuloDoTamanho(tamanho);

  const parametros: ParametrosDaArte = useMemo(
    () => ({ nome, link, cor, tec, rotulo, ...medidas }),
    [nome, link, cor, tec, rotulo, medidas],
  );

  // O que o motor vai desenhar de verdade, ja com os padroes no lugar dos
  // campos vazios. E daqui que sai o destino do QR mostrado na tela: nao do que
  // esta digitado, mas do que a peca vai carregar impressa.
  const entrada = useMemo(() => entradaDosParametros(parametros), [parametros]);

  const desenho = useMemo(() => {
    try {
      const spec = specDosParametros(parametros);
      return {
        svg: buildDisplaySvg(entrada, {
          cornerRadius: cantoDaPrevia(spec),
          fontFamily: "inherit",
          showSafeArea: margemVisivel,
        }),
        erro: null as string | null,
      };
    } catch (causa) {
      // Acontece de verdade: link comprido demais estoura a capacidade do QR.
      // Vira recado no palco, e nao tela em branco com o erro so no console.
      return {
        svg: null,
        erro: causa instanceof Error ? causa.message : "Não deu para desenhar esta peça.",
      };
    }
  }, [parametros, entrada, margemVisivel]);

  const px = pixelSize(specDosParametros(parametros));

  /**
   * O negocio escolhido preenche o nome e o link de uma vez.
   *
   * E a resposta para "para onde este QR aponta": vindo da agenda ou da busca
   * do Google, o link nao foi digitado por ninguem — chegou pronto, junto com o
   * nome e o endereco do lugar. Nao ha o que conferir.
   *
   * O X da busca so desfaz a escolha; o que esta escrito fica. Numa bancada,
   * apagar o que a pessoa acabou de montar seria o pior jeito de dizer "este
   * nao e mais o negocio".
   */
  function escolherNegocio(escolhido: NegocioEscolhido | null) {
    setNegocio(escolhido);
    if (!escolhido) return;

    // O link colado a mao entra pela aba de link e vem sem nome: nesse caso o
    // que ja estava escrito vale mais que um campo apagado.
    if (escolhido.nome) setNome(escolhido.nome);
    setLink(escolhido.linkAvaliacao);
  }

  /**
   * Mexeu no link na mao, a escolha deixa de valer.
   *
   * Sem isso o cartao verde continuaria dizendo "Barbearia Vintage" enquanto o
   * QR ja apontava para outro lugar — que e exatamente o erro que so aparece
   * depois de o acrilico estar cortado.
   */
  function digitarLink(valor: string) {
    setLink(valor);
    if (negocio) setNegocio(null);
  }

  function trocarModelo(id: string) {
    setModeloId(id);

    const modelo = modelos.find((item) => item.id === id);
    if (!modelo) return;

    const doModelo = medidasDoModelo(modelo);
    setMedidas(doModelo);
    setTamanho(tamanhoDasMedidas(doModelo.larguraMm, doModelo.alturaMm));
    setTec(modelo.produto_avaliacao.tecnologia);
  }

  function trocarTamanho(novo: TamanhoDePlaca) {
    setTamanho(novo);
    if (novo === "personalizado") return;

    setMedidas({
      larguraMm: TAMANHOS[novo].largura_mm,
      alturaMm: TAMANHOS[novo].altura_mm,
      margemMm: ACABAMENTO_PADRAO.margem_seguranca_mm,
      sangriaMm: ACABAMENTO_PADRAO.sangria_mm,
      dpi: ACABAMENTO_PADRAO.dpi,
    });
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 md:items-start">
      <div className="flex flex-col gap-5">
        {modelos.length > 0 ? (
          <Secao titulo="Modelo">
            <Selecao
              rotulo="Placa do catálogo"
              value={modeloId}
              onChange={(evento) => trocarModelo(evento.target.value)}
              opcoes={modelos.map((modelo) => ({ valor: modelo.id, texto: modelo.nome }))}
            />
          </Secao>
        ) : null}

        <Secao titulo="O que vai na placa">
          <div className="flex flex-col gap-4">
            {/* A busca vem antes dos campos, como no popup da venda: achado o
                negocio, o nome e o link ja chegam preenchidos e conferidos. */}
            <BuscaDeNegocio
              escolhido={negocio}
              aoEscolher={escolherNegocio}
              cadastrados={negocios}
            />

            <Campo
              rotulo="Nome do negócio"
              placeholder={NEGOCIO_PADRAO}
              autoComplete="off"
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              ajuda="É este nome que vai impresso, no lugar do logo do Google."
            />

            <Campo
              rotulo="Link de avaliação"
              placeholder="https://g.page/r/.../review"
              autoComplete="off"
              value={link}
              onChange={(evento) => digitarLink(evento.target.value)}
            />

            <Cores cor={cor} aoTrocar={setCor} />
          </div>
        </Secao>

        <Secao
          titulo="Medidas"
          acao={
            modelos.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-tinta-suave">Editar</span>
                <Interruptor
                  ligado={livre}
                  rotulo="Editar medidas e tecnologia"
                  onChange={setLivre}
                />
              </div>
            ) : null
          }
        >
          {livre ? (
            <div className="flex flex-col gap-4">
              <Escolha<TamanhoDePlaca>
                titulo="Tamanho"
                selecionado={tamanho}
                aoSelecionar={trocarTamanho}
                opcoes={[
                  {
                    valor: "a6",
                    rotulo: "A6",
                    detalhe: `${TAMANHOS.a6.largura_mm} × ${TAMANHOS.a6.altura_mm} mm`,
                  },
                  {
                    valor: "a5",
                    rotulo: "A5",
                    detalhe: `${TAMANHOS.a5.largura_mm} × ${TAMANHOS.a5.altura_mm} mm`,
                  },
                  { valor: "personalizado", rotulo: "Personalizado", detalhe: "Você digita" },
                ]}
              />

              <Escolha<TecnologiaArte>
                titulo="Tecnologia"
                selecionado={tec}
                aoSelecionar={setTec}
                opcoes={TECNOLOGIAS.map((valor) => ({
                  valor,
                  rotulo: ROTULO_TECNOLOGIA[valor],
                  detalhe: valor === "qr_nfc" ? "Dois cartões" : "Um cartão",
                }))}
              />

              {tamanho === "personalizado" ? (
                // A `key` remonta os campos quando o modelo muda: cada `Numero`
                // guarda o texto que esta sendo digitado, e sem isso trocar de
                // uma placa personalizada para outra deixaria a medida antiga
                // escrita na tela enquanto o desenho ja mostrava a nova.
                <div key={modeloId} className="grid grid-cols-2 gap-3">
                  <Numero
                    rotulo="Largura (mm)"
                    valor={medidas.larguraMm}
                    limite={LIMITES.larguraMm}
                    aoMudar={(larguraMm) => setMedidas((atual) => ({ ...atual, larguraMm }))}
                  />
                  <Numero
                    rotulo="Altura (mm)"
                    valor={medidas.alturaMm}
                    limite={LIMITES.alturaMm}
                    aoMudar={(alturaMm) => setMedidas((atual) => ({ ...atual, alturaMm }))}
                  />
                  <Numero
                    rotulo="Margem (mm)"
                    valor={medidas.margemMm}
                    limite={LIMITES.margemMm}
                    aoMudar={(margemMm) => setMedidas((atual) => ({ ...atual, margemMm }))}
                  />
                  <Numero
                    rotulo="Sangria (mm)"
                    valor={medidas.sangriaMm}
                    limite={LIMITES.sangriaMm}
                    aoMudar={(sangriaMm) => setMedidas((atual) => ({ ...atual, sangriaMm }))}
                  />
                  <Numero
                    rotulo="DPI"
                    valor={medidas.dpi}
                    limite={LIMITES.dpi}
                    aoMudar={(dpi) => setMedidas((atual) => ({ ...atual, dpi }))}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-tinta-suave">
              {medidas.larguraMm} × {medidas.alturaMm} mm · {ROTULO_TECNOLOGIA[tec]}
            </p>
          )}

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-borda pt-4">
            <span className="text-sm text-tinta">Mostrar a margem de segurança</span>
            <Interruptor
              ligado={margemVisivel}
              rotulo="Mostrar a margem de segurança"
              onChange={setMargemVisivel}
            />
          </div>
        </Secao>
      </div>

      <div className="md:sticky md:top-6">
        <Secao titulo="Prévia">
          <div className="flex min-h-72 items-center justify-center rounded-lg bg-superficie p-4">
            {desenho.svg ? (
              <div
                role="img"
                aria-label={`${rotulo} em ${ROTULO_COR[cor].toLowerCase()}`}
                // O SVG sai do motor com `width`/`height` em decimo de
                // milimetro — 1070 para o A6. Sem soltar as duas medidas ele
                // desenharia com 1070 pixels e furaria a coluna: `h-auto` mais
                // `max-w-full` e a receita de SVG que cabe no espaco que tem,
                // e o teto em `vh` segura a placa alta na tela do notebook.
                className="[&>svg]:h-auto [&>svg]:max-h-[58vh] [&>svg]:w-auto [&>svg]:max-w-full [&>svg]:drop-shadow-[0_1px_5px_rgba(9,25,46,0.14)]"
                dangerouslySetInnerHTML={{ __html: desenho.svg }}
              />
            ) : (
              <p className="max-w-xs text-center text-sm font-medium text-erro">{desenho.erro}</p>
            )}
          </div>

          <p className="mt-4 text-xs text-tinta-suave tabular-nums">
            {medidas.larguraMm} × {medidas.alturaMm} mm · {medidas.dpi} DPI · {px.width} ×{" "}
            {px.height} px
            {medidas.sangriaMm > 0 ? ` · sangria de ${medidas.sangriaMm} mm` : ""}
          </p>

          <DestinoDoQr url={entrada.reviewUrl} negocio={negocio} digitado={link} />

          <div className="mt-3 flex flex-wrap gap-2">
            <LinkBotao
              href={paraQuery(parametros, "jpg")}
              download={nomeDoArquivo(parametros, "jpg")}
              externo
            >
              <Download size={16} aria-hidden />
              Baixar JPG
            </LinkBotao>
            <LinkBotao
              href={paraQuery(parametros, "svg")}
              download={nomeDoArquivo(parametros, "svg")}
              variante="secundario"
              externo
            >
              <FileCode2 size={16} aria-hidden />
              Baixar SVG
            </LinkBotao>
          </div>

          <p className="mt-3 text-xs text-tinta-suave">
            O JPG sai no tamanho real e com o canto reto — é o mesmo arquivo que o pedido manda para
            a gráfica. Em placa grande ele leva alguns segundos.
          </p>
        </Secao>
      </div>
    </div>
  );
}

type Medidas = Pick<ParametrosDaArte, "larguraMm" | "alturaMm" | "margemMm" | "sangriaMm" | "dpi">;

/** As medidas de um modelo do catalogo, ou o A6 quando nao ha catalogo nenhum. */
function medidasDoModelo(modelo: ModeloDoGerador | null): Medidas {
  if (!modelo) {
    return {
      larguraMm: TAMANHOS.a6.largura_mm,
      alturaMm: TAMANHOS.a6.altura_mm,
      margemMm: ACABAMENTO_PADRAO.margem_seguranca_mm,
      sangriaMm: ACABAMENTO_PADRAO.sangria_mm,
      dpi: ACABAMENTO_PADRAO.dpi,
    };
  }

  // O PostgREST devolve `numeric` como numero, mas as medidas vem de cadastro
  // de gente: `Number` aqui e o mesmo cuidado que `tamanhoDasMedidas` ja toma.
  const placa = modelo.produto_avaliacao;
  return {
    larguraMm: Number(placa.largura_mm),
    alturaMm: Number(placa.altura_mm),
    margemMm: Number(placa.margem_seguranca_mm),
    sangriaMm: Number(placa.sangria_mm),
    dpi: Number(placa.dpi),
  };
}

function rotuloDoTamanho(tamanho: TamanhoDePlaca): string {
  return tamanho === "personalizado" ? "Personalizado" : TAMANHOS[tamanho].rotulo;
}

/**
 * Campo de numero que nunca deixa o desenho sem valor.
 *
 * O input devolve string vazia enquanto a pessoa apaga para redigitar, e um
 * `Number("")` viraria zero no meio do layout — o que quebra a conta do QR. O
 * campo segura o texto que esta sendo digitado, e o desenho so recebe numero
 * dentro da faixa; ao sair do campo, o texto volta para o valor que valeu.
 */
function Numero({
  rotulo,
  valor,
  limite,
  aoMudar,
}: {
  rotulo: string;
  valor: number;
  limite: { min: number; max: number };
  aoMudar: (valor: number) => void;
}) {
  const [texto, setTexto] = useState(String(valor));

  return (
    <Campo
      rotulo={rotulo}
      placeholder={String(limite.min)}
      type="number"
      inputMode="decimal"
      min={limite.min}
      max={limite.max}
      value={texto}
      onChange={(evento) => {
        const bruto = evento.target.value;
        setTexto(bruto);

        const numero = Number(bruto);
        if (bruto.trim() === "" || Number.isNaN(numero)) return;
        if (numero < limite.min || numero > limite.max) return;
        aoMudar(numero);
      }}
      onBlur={() => setTexto(String(valor))}
    />
  );
}

/** As duas cores, no mesmo controle de bolinha da vitrine de `/vender`. */
function Cores({ cor, aoTrocar }: { cor: CorArte; aoTrocar: (cor: CorArte) => void }) {
  return (
    <fieldset>
      <legend className="text-rotulo mb-1.5 font-medium text-tinta">Cor</legend>
      <div className="flex gap-2">
        {CORES.map((opcao) => {
          const ativa = opcao === cor;
          return (
            <button
              key={opcao}
              type="button"
              onClick={() => aoTrocar(opcao)}
              aria-pressed={ativa}
              className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-sm transition-colors ${
                ativa
                  ? "border-marca bg-marca-suave text-marca"
                  : "border-borda bg-superficie text-tinta hover:border-borda-forte"
              }`}
            >
              <span
                aria-hidden
                className="size-4 rounded-full border border-borda-forte shadow-sm"
                style={{ backgroundColor: THEMES[opcao].background }}
              />
              {ROTULO_COR[opcao]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Para onde o QR desta peca aponta, escrito por extenso.
 *
 * Fica colado nos botoes de baixar porque e a ultima coisa a ler antes de o
 * arquivo virar acrilico. O QR e ilegivel para gente, e tres coisas diferentes
 * levam ao mesmo desenho de quadradinhos: o link certo, o encurtado do Maps que
 * abre a ficha em vez do formulario, e o campo vazio que cai no endereco de
 * exemplo. Nenhuma das tres da para distinguir olhando a previa.
 *
 * Mostra a URL que foi codificada, e nao a que esta digitada — sao diferentes
 * justamente no caso perigoso, o do campo em branco.
 *
 * O "Abrir" e o teste que vale: o navegador segue o encurtador e mostra onde a
 * coisa termina. Avisa, mas nao trava: a bancada existe para ver link torto
 * tambem.
 */
function DestinoDoQr({
  url,
  negocio,
  digitado,
}: {
  url: string;
  negocio: NegocioEscolhido | null;
  digitado: string;
}) {
  const doExemplo = !digitado.trim();
  const valido = Boolean(validarLinkAvaliacao(url));

  return (
    <div className="mt-4 rounded-lg border border-borda bg-papel p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold tracking-wide text-tinta-suave uppercase">
          O QR aponta para
        </span>
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="flex shrink-0 items-center gap-1 text-xs font-medium text-marca transition-colors hover:text-marca-escura"
        >
          <ExternalLink size={12} aria-hidden />
          Abrir
        </a>
      </div>

      <p className="mt-1.5 font-mono text-xs break-all text-tinta">{url}</p>

      {negocio?.nome ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-marca">
          <Check size={13} aria-hidden className="mt-px shrink-0" />
          <span>
            {negocio.nome}
            {negocio.endereco ? ` · ${negocio.endereco}` : ""}
          </span>
        </p>
      ) : (
        <p
          className={`mt-2 flex items-start gap-1.5 text-xs ${
            valido && !doExemplo ? "text-tinta-suave" : "font-medium text-erro"
          }`}
        >
          {valido && !doExemplo ? null : <TriangleAlert size={13} aria-hidden className="mt-px shrink-0" />}
          <span>{recadoDoDestino(doExemplo, valido)}</span>
        </p>
      )}
    </div>
  );
}

function recadoDoDestino(doExemplo: boolean, valido: boolean): string {
  if (doExemplo) return `Link em branco: a peça sai com o endereço de exemplo (${LINK_PADRAO}).`;
  if (valido) return "Abre o formulário de avaliação do Google.";

  return "Não é um link de avaliação. Abra para ver onde cai — o encurtado do Maps leva à ficha do negócio, onde ninguém avalia.";
}
