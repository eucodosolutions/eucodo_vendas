"use client";

import { Check, Link2, Loader2, MapPin, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { ALTURA_CONTROLE, BORDA_ERRO, BORDA_NORMAL, juntar, MOLDURA_CONTROLE } from "./controle";
import { validarLinkAvaliacao } from "@/lib/formato";
import { buscarNegocio, type NegocioEncontrado } from "@/lib/places/buscar";

/** O que a tela precisa saber depois que o negocio foi resolvido. */
export type NegocioEscolhido = {
  nome: string;
  linkAvaliacao: string;
  /** So existe quando veio da busca; o link colado a mao nao tem id. */
  placeId?: string;
};

// Tempo entre a ultima tecla e a chamada. Cada busca e uma chamada paga: 450ms
// e o que separa "digitou o nome" de "digitou cada letra".
const ESPERA_ENTRE_TECLAS = 450;
const MINIMO_DE_BUSCA = 3;

/**
 * Como o link de avaliacao entra no sistema.
 *
 * O caminho normal e buscar o negocio no Google, porque o link que abre a caixa
 * de avaliacao so existe dentro do painel de quem gerencia o perfil — de fora,
 * quem sabe montar ele e a Places API. Colar o encurtado do Maps parece dar
 * certo e nao da: vira um QR que abre a ficha do negocio, onde ninguem avalia.
 *
 * O campo de colar continua existindo, atras de um clique, para quem chega com
 * o g.page do proprio perfil na mao. So que agora ele confere o formato, em vez
 * de aceitar qualquer endereco do Google.
 */
export function BuscaDeNegocio({
  escolhido,
  aoEscolher,
}: {
  escolhido: NegocioEscolhido | null;
  aoEscolher: (negocio: NegocioEscolhido | null) => void;
}) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<NegocioEncontrado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [manual, setManual] = useState(false);

  const rotuloId = useId();

  // Resposta lenta de uma busca antiga nao pode sobrescrever a nova: so a
  // ultima chamada disparada tem direito de escrever na lista.
  const chamadaAtual = useRef(0);

  // Apagar a lista e assunto de quem digitou, e nao do efeito: e no momento da
  // tecla que se sabe que o termo encolheu. Lista velha embaixo de termo novo e
  // o convite para escolher o negocio errado.
  function digitar(valor: string) {
    setTermo(valor);

    if (valor.trim().length < MINIMO_DE_BUSCA) {
      chamadaAtual.current++;
      setResultados([]);
      setErro(null);
      setBuscando(false);
    } else {
      setBuscando(true);
    }
  }

  useEffect(() => {
    if (manual || escolhido) return;

    const procurado = termo.trim();
    if (procurado.length < MINIMO_DE_BUSCA) return;

    const chamada = ++chamadaAtual.current;

    const agendada = setTimeout(async () => {
      const resposta = await buscarNegocio(procurado);
      if (chamada !== chamadaAtual.current) return;

      setResultados(resposta.negocios);
      setErro(resposta.erro ?? null);
      setBuscando(false);
    }, ESPERA_ENTRE_TECLAS);

    return () => clearTimeout(agendada);
  }, [termo, manual, escolhido]);

  function limpar() {
    aoEscolher(null);
    setTermo("");
    setResultados([]);
    setErro(null);
  }

  if (escolhido) {
    return (
      <Moldura rotuloId={rotuloId}>
        <div className="flex items-start gap-3 rounded-lg border border-marca bg-marca-suave px-3 py-2.5">
          <Check size={16} aria-hidden className="mt-0.5 shrink-0 text-marca" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-marca">
              {escolhido.nome || "Link do próprio perfil"}
            </p>
            <p className="truncate text-xs text-tinta-suave">{escolhido.linkAvaliacao}</p>
          </div>
          <button
            type="button"
            onClick={limpar}
            aria-label="Trocar de negócio"
            className="shrink-0 rounded p-1 text-tinta-suave transition-colors hover:text-tinta"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      </Moldura>
    );
  }

  if (manual) {
    return (
      <Moldura rotuloId={rotuloId}>
        <ColarLink
          aoColar={(link) => aoEscolher({ nome: "", linkAvaliacao: link })}
          aoDesistir={() => setManual(false)}
        />
      </Moldura>
    );
  }

  const buscaCompleta = termo.trim().length >= MINIMO_DE_BUSCA;

  return (
    <Moldura rotuloId={rotuloId}>
      <div className="relative">
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-suave"
        />
        <input
          type="text"
          aria-labelledby={rotuloId}
          autoComplete="off"
          placeholder="Barbearia Vintage, Fortaleza"
          value={termo}
          onChange={(evento) => digitar(evento.target.value)}
          className={juntar(
            ALTURA_CONTROLE,
            MOLDURA_CONTROLE,
            BORDA_NORMAL,
            "pr-10 pl-9 placeholder:text-tinta-suave/70",
          )}
        />
        {buscando ? (
          <Loader2
            size={16}
            aria-hidden
            className="absolute top-1/2 right-3 -translate-y-1/2 animate-spin text-tinta-suave"
          />
        ) : null}
      </div>

      {resultados.length > 0 ? (
        <ul className="divide-y divide-borda overflow-hidden rounded-lg border border-borda">
          {resultados.map((negocio) => (
            <li key={negocio.placeId}>
              <button
                type="button"
                onClick={() =>
                  aoEscolher({
                    nome: negocio.nome,
                    linkAvaliacao: negocio.linkAvaliacao,
                    placeId: negocio.placeId,
                  })
                }
                className="flex w-full items-start gap-3 bg-superficie px-3 py-2.5 text-left transition-colors hover:bg-papel"
              >
                <MapPin size={15} aria-hidden className="mt-0.5 shrink-0 text-tinta-suave" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-tinta">{negocio.nome}</p>
                  <p className="truncate text-xs text-tinta-suave">{negocio.endereco}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {erro ? <p className="text-xs font-medium text-erro">{erro}</p> : null}

      {!erro && !buscando && buscaCompleta && resultados.length === 0 ? (
        <p className="text-xs text-tinta-suave">Nada com esse nome. Tente incluir a cidade.</p>
      ) : null}

      <button
        type="button"
        onClick={() => setManual(true)}
        className="flex items-center gap-1.5 self-start text-xs font-medium text-marca transition-colors hover:text-marca-escura"
      >
        <Link2 size={13} aria-hidden />
        Já tenho o link do perfil
      </button>
    </Moldura>
  );
}

function Moldura({ rotuloId, children }: { rotuloId: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span id={rotuloId} className="text-rotulo font-medium text-tinta">
        Negócio no Google
      </span>
      {children}
    </div>
  );
}

/**
 * O escape: quem gerencia o perfil ja tem o link certo e nao precisa procurar.
 *
 * O que ele confere e o formato, e nao o dominio. Aceitar maps.app.goo.gl era o
 * problema antigo: o link e do Google, abre normalmente, e leva para a ficha do
 * negocio em vez do formulario de avaliacao.
 */
function ColarLink({
  aoColar,
  aoDesistir,
}: {
  aoColar: (link: string) => void;
  aoDesistir: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function confirmar() {
    const link = validarLinkAvaliacao(texto);
    if (!link) {
      setErro("Este link não abre a caixa de avaliação. Use o do painel do Google.");
      return;
    }

    setErro(null);
    aoColar(link);
  }

  return (
    <>
      <input
        type="url"
        inputMode="url"
        autoComplete="off"
        autoFocus
        placeholder="https://g.page/r/.../review"
        value={texto}
        onChange={(evento) => {
          setTexto(evento.target.value);
          setErro(null);
        }}
        onBlur={() => {
          if (texto.trim()) confirmar();
        }}
        aria-invalid={erro ? true : undefined}
        className={juntar(
          ALTURA_CONTROLE,
          MOLDURA_CONTROLE,
          erro ? BORDA_ERRO : BORDA_NORMAL,
          "px-3 placeholder:text-tinta-suave/70",
        )}
      />

      {erro ? (
        <p className="text-xs font-medium text-erro">{erro}</p>
      ) : (
        <p className="text-xs text-tinta-suave">
          É o link de <strong>Peça avaliações</strong>, no painel do Perfil da Empresa. O encurtado
          do Maps não serve: ele abre a ficha, não a avaliação.
        </p>
      )}

      <button
        type="button"
        onClick={aoDesistir}
        className="flex items-center gap-1.5 self-start text-xs font-medium text-marca transition-colors hover:text-marca-escura"
      >
        <Search size={13} aria-hidden />
        Procurar o negócio no Google
      </button>
    </>
  );
}
