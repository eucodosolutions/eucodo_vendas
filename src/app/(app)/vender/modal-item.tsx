"use client";

import { useRef, useState, useTransition } from "react";

import { Quantidade } from "./quantidade";
import type { ProdutoDaVenda } from "./venda-rapida";
import { garantirNegocio } from "../negocios/actions";
import { avisar } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import {
  BuscaDeNegocio,
  type NegocioCadastrado,
  type NegocioEscolhido,
} from "@/components/ui/busca-de-negocio";
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
  cor,
  negocios,
  aoFechar,
  aoAdicionar,
  aoCadastrarNegocio,
}: {
  /** Nulo com o popup fechado: e o proprio produto que abre a tela. */
  produto: ProdutoDaVenda | null;
  /** A cor que estava na vitrine quando o produto foi tocado. */
  cor: CorArte | null;
  /** A agenda de negocios de quem esta vendendo. */
  negocios: NegocioCadastrado[];
  aoFechar: () => void;
  aoAdicionar: (item: Omit<ItemDoCarrinho, "chave">) => void;
  /** O negocio recem-criado entra na agenda sem esperar a proxima visita. */
  aoCadastrarNegocio: (negocio: NegocioCadastrado) => void;
}) {
  if (!produto) return null;

  // A `key` e o reset: cada produto monta um formulario proprio, ja com os
  // valores dele. Sem ela, o link da placa anterior ficaria no campo do proximo
  // negocio — que e exatamente o erro que vira QR errado impresso em acrilico.
  return (
    <Formulario
      key={produto.id}
      produto={produto}
      corInicial={cor}
      negocios={negocios}
      aoFechar={aoFechar}
      aoAdicionar={aoAdicionar}
      aoCadastrarNegocio={aoCadastrarNegocio}
    />
  );
}

function Formulario({
  produto,
  corInicial,
  negocios,
  aoFechar,
  aoAdicionar,
  aoCadastrarNegocio,
}: {
  produto: ProdutoDaVenda;
  corInicial: CorArte | null;
  negocios: NegocioCadastrado[];
  aoFechar: () => void;
  aoAdicionar: (item: Omit<ItemDoCarrinho, "chave">) => void;
  aoCadastrarNegocio: (negocio: NegocioCadastrado) => void;
}) {
  const placa = produto.produto_avaliacao;

  const [cor, setCor] = useState<CorArte | null>(corInicial ?? placa?.cores[0] ?? null);
  const [quantidade, setQuantidade] = useState(1);
  const [negocio, setNegocio] = useState<NegocioEscolhido | null>(null);
  const [nomeNegocio, setNomeNegocio] = useState("");
  const [gravando, comecarAGravar] = useTransition();

  const campoDoNegocio = useRef<HTMLInputElement>(null);

  function escolherNegocio(escolhido: NegocioEscolhido | null) {
    setNegocio(escolhido);
    // O nome que veio do Google entra como sugestao e continua editavel: e ele
    // que vai impresso, e "Barbearia Vintage LTDA" nao e o que o dono quer ver
    // no acrilico. Trocar de negocio limpa o campo, senao o nome do anterior
    // ficaria colado no link do novo.
    setNomeNegocio(escolhido?.nome ?? "");
  }

  function confirmar() {
    if (!placa) {
      adicionar();
      return;
    }

    if (!negocio) {
      avisar.atencao("Escolha um negócio da sua lista ou encontre no Google.");
      return;
    }

    const nome = nomeNegocio.trim();
    if (nome.length < 2) {
      avisar.atencao("Digite o nome do negócio que vai impresso nesta placa.");
      campoDoNegocio.current?.focus();
      return;
    }

    // Veio da agenda: o cadastro ja existe, nada a gravar.
    if (negocio.id) {
      adicionar(negocio.id);
      return;
    }

    // Veio do Google ou de um link colado, e vira cadastro aqui, antes de o
    // item entrar no carrinho. E o unico momento em que o sistema tem o negocio
    // por inteiro na mao: uma venda que nao fecha ainda deixa registrada a
    // porta em que se bateu, que e a metade da lista de amanha.
    comecarAGravar(async () => {
      const resposta = await garantirNegocio({
        nome,
        linkAvaliacao: negocio.linkAvaliacao,
        placeId: negocio.placeId,
        endereco: negocio.endereco,
      });

      if (!resposta.negocioId) {
        avisar.erro(resposta.erro ?? "Não consegui cadastrar este negócio.");
        return;
      }

      aoCadastrarNegocio({
        id: resposta.negocioId,
        nome,
        link_avaliacao: negocio.linkAvaliacao,
        google_place_id: negocio.placeId ?? null,
        endereco: negocio.endereco ?? null,
      });

      adicionar(resposta.negocioId);
    });
  }

  function adicionar(negocioId?: string) {
    aoAdicionar({
      produtoId: produto.id,
      tipo: produto.tipo,
      produtoNome: produto.nome,
      precoUnitarioCentavos: produto.preco_centavos,
      quantidade,
      cor: cor ?? undefined,
      negocioId: placa ? negocioId : undefined,
      nomeNegocio: placa ? nomeNegocio.trim() : undefined,
      linkAvaliacao: placa ? negocio!.linkAvaliacao : undefined,
      placeId: placa ? negocio!.placeId : undefined,
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
          <Botao type="button" variante="secundario" onClick={aoFechar} disabled={gravando}>
            Cancelar
          </Botao>
          <Botao
            type="button"
            onClick={confirmar}
            carregando={gravando}
            carregandoTexto="Salvando negócio..."
          >
            Adicionar {moeda(produto.preco_centavos * quantidade)}
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {placa ? (
          <>
            {/* A busca vem antes do nome de proposito: achado o negocio, o
                nome ja chega preenchido e o vendedor so ajusta se quiser. */}
            <BuscaDeNegocio
              escolhido={negocio}
              aoEscolher={escolherNegocio}
              cadastrados={negocios}
            />

            {negocio ? (
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
            ) : null}

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
