"use client";

import { Plus, QrCode } from "lucide-react";
import { useState } from "react";

import type { ProdutoDaVenda } from "./venda-rapida";
import { Botao } from "@/components/ui/botao";
import { THEMES } from "@/lib/art/theme";
import { tamanhoDasMedidas } from "@/lib/catalogo";
import { moeda, ROTULO_COR, ROTULO_TECNOLOGIA } from "@/lib/formato";
import type { CorArte } from "@/types/database";

/**
 * O produto na vitrine: a peca, o nome, o preco, o prazo e um botao.
 *
 * Tudo que o item precisa alem disso — nome do negocio, link, quantidade — sai
 * no popup do "Adicionar". A tela antiga trazia esses campos abertos para o
 * produto selecionado, e com quatro produtos no catalogo isso virou um
 * formulario comprido no lugar de uma loja.
 */
export function CartaoDeProduto({
  produto,
  aoAdicionar,
}: {
  produto: ProdutoDaVenda;
  aoAdicionar: (cor: CorArte | null) => void;
}) {
  // A cor mora no card, e nao so no popup: e aqui que o cliente ve a peca, e
  // "prefiro a preta" e a primeira coisa que ele diz quando ve as duas.
  const [cor, setCor] = useState<CorArte | null>(produto.previas[0]?.cor ?? null);

  return (
    <article className="flex flex-col overflow-hidden rounded-card border border-borda bg-superficie transition-colors hover:border-borda-forte">
      <Imagem produto={produto} cor={cor} aoTrocarCor={setCor} />

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-sm font-semibold text-tinta">{produto.nome}</h3>
        <p className="mt-0.5 line-clamp-2 text-xs text-tinta-suave">{legenda(produto)}</p>

        <p className="mt-3 text-2xl font-semibold tracking-tight text-tinta tabular-nums">
          {moeda(produto.preco_centavos)}
        </p>
        <p className="text-xs text-tinta-suave">
          Entrega em {produto.prazo_entrega_dias}{" "}
          {produto.prazo_entrega_dias === 1 ? "dia" : "dias"}
        </p>

        {/* `mt-auto` gruda o botao no rodape: com nomes de uma e de duas linhas
            lado a lado, os botoes da grade ficariam em alturas diferentes. */}
        <div className="mt-4 pt-1">
          <Botao type="button" larguraTotal onClick={() => aoAdicionar(cor)}>
            <Plus size={16} aria-hidden />
            Adicionar
          </Botao>
        </div>
      </div>
    </article>
  );
}

/**
 * O palco onde a peca aparece, sempre na proporcao real do display.
 *
 * Fundo branco, e nao o papel da pagina: o produto e uma peca fotografada, e
 * fundo cinza atras dela deixava o cartao com dois tons. Quem separa o palco do
 * resto do cartao e a linha de baixo, e quem destaca a peca branca do fundo
 * branco e a sombra dela.
 */
const PALCO =
  "flex aspect-[4/3] w-full items-center justify-center border-b border-borda bg-superficie";

/**
 * A imagem do produto.
 *
 * Foto quando existe uma; senao a peca de exemplo desenhada pelo motor de arte,
 * que e o mais perto do produto real que da para mostrar antes de o cliente
 * dizer o nome do negocio dele. O SVG entra inteiro e se ajusta ao palco pelo
 * proprio viewBox, entao a peca nunca estica: no celular, onde o card ocupa a
 * largura toda, era exatamente isso que acontecia com a miniatura antiga.
 */
function Imagem({
  produto,
  cor,
  aoTrocarCor,
}: {
  produto: ProdutoDaVenda;
  cor: CorArte | null;
  aoTrocarCor: (cor: CorArte) => void;
}) {
  if (produto.foto_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={produto.foto_url}
        alt={produto.nome}
        className={`${PALCO} object-cover`}
      />
    );
  }

  const previa = produto.previas.find((item) => item.cor === cor) ?? produto.previas[0];

  if (!previa) return <SemArte produto={produto} />;

  return (
    <div className={`relative ${PALCO} p-5`}>
      <div
        role="img"
        aria-label={`${produto.nome} em ${ROTULO_COR[previa.cor].toLowerCase()}`}
        className="h-full w-full [&>svg]:h-full [&>svg]:w-full [&>svg]:drop-shadow-[0_1px_5px_rgba(9,25,46,0.14)]"
        dangerouslySetInnerHTML={{ __html: previa.svg }}
      />

      {produto.previas.length > 1 ? (
        <div className="absolute inset-y-0 right-1 flex flex-col items-center justify-center">
          {produto.previas.map((item) => {
            const ativa = item.cor === previa.cor;
            return (
              <button
                key={item.cor}
                type="button"
                onClick={() => aoTrocarCor(item.cor)}
                aria-pressed={ativa}
                // O botao tem a area de toque do sistema; o circulo dentro dele
                // e so o que se ve. Diminuir o alvo para caber no palco seria
                // trocar o dedo do vendedor pela sobra de dois pixels.
                className="flex size-10 items-center justify-center"
              >
                <span
                  className={`size-6 rounded-full shadow-sm transition-colors ${
                    ativa ? "border-2 border-marca" : "border border-borda-forte"
                  }`}
                  style={{ backgroundColor: THEMES[item.cor].background }}
                />
                <span className="sr-only">{ROTULO_COR[item.cor]}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Sem foto e sem arte: sobra a miniatura do formato.
 *
 * Cai aqui o produto padrao que ninguem fotografou e a placa cadastrada sem
 * nenhuma cor. E a moldura em branco do display, na proporcao dele.
 */
function SemArte({ produto }: { produto: ProdutoDaVenda }) {
  const placa = produto.produto_avaliacao;

  if (!placa) return <div className={PALCO} />;

  const tamanho = tamanhoDasMedidas(placa.largura_mm, placa.altura_mm);

  return (
    <div className={`${PALCO} p-5`}>
      <div
        className="flex h-full flex-col items-center justify-center gap-1.5 rounded-lg border border-borda-forte bg-superficie"
        style={{ aspectRatio: `${Number(placa.largura_mm)} / ${Number(placa.altura_mm)}` }}
      >
        <QrCode size={26} aria-hidden className="text-tinta-media" />
        <span className="text-xs font-semibold tracking-wide text-tinta-media uppercase">
          {tamanho === "personalizado"
            ? `${Number(placa.largura_mm)}×${Number(placa.altura_mm)} mm`
            : tamanho.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

/** Descricao para o produto padrao, tecnologia para a placa. */
function legenda(produto: ProdutoDaVenda): string {
  if (produto.produto_avaliacao) {
    return ROTULO_TECNOLOGIA[produto.produto_avaliacao.tecnologia];
  }
  return produto.descricao ?? "";
}
