"use client";

import { useRef, useState } from "react";

import { Quantidade } from "./quantidade";
import type { ProdutoDaVenda } from "./venda-rapida";
import { avisar } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Escolha } from "@/components/ui/escolha";
import { Modal } from "@/components/ui/modal";
import type { ItemDoCarrinho } from "@/lib/carrinho/carrinho";
import { moeda, ROTULO_COR, ROTULO_TECNOLOGIA } from "@/lib/formato";
import type { CorArte } from "@/types/database";

/**
 * O popup do "Adicionar": o que ainda falta saber sobre este item.
 *
 * A placa pergunta tres coisas (cor, nome do negocio e link), o produto padrao
 * nao pergunta nenhuma — e por isso ele abre praticamente so com a quantidade.
 * Manter o mesmo popup para os dois e de proposito: o gesto de vender e um so,
 * e o vendedor nao precisa aprender dois caminhos.
 */
export function ModalItem({
  produto,
  aoFechar,
  aoAdicionar,
}: {
  /** Nulo com o popup fechado: e o proprio produto que abre a tela. */
  produto: ProdutoDaVenda | null;
  aoFechar: () => void;
  aoAdicionar: (item: Omit<ItemDoCarrinho, "chave">) => void;
}) {
  if (!produto) return null;

  // A `key` e o reset: cada produto monta um formulario proprio, ja com os
  // valores dele. Sem ela, o link da placa anterior ficaria no campo do proximo
  // negocio — que e exatamente o erro que vira QR errado impresso em acrilico.
  return (
    <Formulario
      key={produto.id}
      produto={produto}
      aoFechar={aoFechar}
      aoAdicionar={aoAdicionar}
    />
  );
}

function Formulario({
  produto,
  aoFechar,
  aoAdicionar,
}: {
  produto: ProdutoDaVenda;
  aoFechar: () => void;
  aoAdicionar: (item: Omit<ItemDoCarrinho, "chave">) => void;
}) {
  const placa = produto.produto_avaliacao;

  const [cor, setCor] = useState<CorArte | null>(placa?.cores[0] ?? null);
  const [quantidade, setQuantidade] = useState(1);
  const [nomeNegocio, setNomeNegocio] = useState("");
  const [linkAvaliacao, setLinkAvaliacao] = useState("");

  const campoDoNegocio = useRef<HTMLInputElement>(null);

  function confirmar() {
    if (placa) {
      if (nomeNegocio.trim().length < 2) {
        avisar.atencao("Digite o nome do negócio que vai impresso nesta placa.");
        campoDoNegocio.current?.focus();
        return;
      }

      if (!linkAvaliacao.trim()) {
        avisar.atencao("Cole o link de avaliação do Google deste negócio.");
        return;
      }
    }

    aoAdicionar({
      produtoId: produto.id,
      tipo: produto.tipo,
      produtoNome: produto.nome,
      precoUnitarioCentavos: produto.preco_centavos,
      quantidade,
      cor: cor ?? undefined,
      nomeNegocio: placa ? nomeNegocio.trim() : undefined,
      linkAvaliacao: placa ? linkAvaliacao.trim() : undefined,
    });

    aoFechar();
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={produto.nome}
      descricao={
        placa
          ? ROTULO_TECNOLOGIA[placa.tecnologia]
          : (produto.descricao ?? `Entrega em ${produto.prazo_entrega_dias} dias`)
      }
      rodape={
        <>
          <Botao type="button" variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="button" onClick={confirmar}>
            Adicionar {moeda(produto.preco_centavos * quantidade)}
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {placa ? (
          <>
            <Campo
              ref={campoDoNegocio}
              rotulo="Nome do negócio"
              name="nomeNegocio"
              placeholder="Barbearia Vintage"
              autoComplete="off"
              value={nomeNegocio}
              onChange={(evento) => setNomeNegocio(evento.target.value)}
              ajuda="É este nome que vai impresso no display, no lugar do logo do Google."
            />

            <Campo
              rotulo="Link de avaliação do Google"
              name="linkAvaliacao"
              placeholder="https://g.page/r/.../review"
              inputMode="url"
              value={linkAvaliacao}
              onChange={(evento) => setLinkAvaliacao(evento.target.value)}
              ajuda="Aceita o link do g.page, o encurtado do Maps ou o endereço completo."
            />

            {/* A tecnologia nao e escolha aqui: ela e o proprio produto, e cada
                uma tem o seu preco. O que muda dentro do produto e so a cor. */}
            {placa.cores.length > 1 ? (
              <Escolha
                titulo="Arte"
                opcoes={placa.cores.map((valor) => ({
                  valor,
                  rotulo: ROTULO_COR[valor],
                  detalhe: valor === "branco" ? "Fundo claro" : "Fundo escuro",
                }))}
                selecionado={cor ?? placa.cores[0]}
                aoSelecionar={setCor}
              />
            ) : null}
          </>
        ) : null}

        <div className="flex items-center justify-between gap-4 border-t border-borda pt-4">
          <div>
            <span className="text-xs font-semibold tracking-wide text-tinta-suave uppercase">
              Quantidade
            </span>
            <p className="mt-0.5 text-sm text-tinta-suave tabular-nums">
              {moeda(produto.preco_centavos)} cada
            </p>
          </div>
          <Quantidade valor={quantidade} aoMudar={setQuantidade} descricao={produto.nome} />
        </div>
      </div>
    </Modal>
  );
}
