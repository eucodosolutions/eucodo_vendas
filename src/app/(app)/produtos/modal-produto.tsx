"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useState } from "react";

import { FotoDoProduto } from "./foto-do-produto";
import { removerProduto, salvarProduto, type EstadoProduto } from "./actions";
import { useAoDarCerto } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo, CampoTexto } from "@/components/ui/campo";
import { Confirmacao } from "@/components/ui/confirmacao";
import { Escolha } from "@/components/ui/escolha";
import { ModalDeFormulario } from "@/components/ui/modal-de-formulario";
import { CORES, DETALHE_DO_TIPO, TECNOLOGIAS, TIPOS } from "@/lib/catalogo";
import { ROTULO_COR, ROTULO_TECNOLOGIA, ROTULO_TIPO_PRODUTO } from "@/lib/formato";
import type { CorArte, TecnologiaArte, TipoProduto } from "@/types/database";

export type ProdutoEditavel = {
  id: string;
  tipo: TipoProduto;
  codigo: string;
  nome: string;
  descricao: string | null;
  foto_url: string | null;
  preco_centavos: number;
  comissao_percentual: number;
  prazo_entrega_dias: number;
  ativo: boolean;
  produto_avaliacao: {
    largura_mm: number;
    altura_mm: number;
    margem_seguranca_mm: number;
    sangria_mm: number;
    dpi: number;
    cores: CorArte[];
    tecnologias: TecnologiaArte[];
  } | null;
};

/** Prazo sugerido para produto novo. O prazo que vale e sempre o do produto. */
const PRAZO_SUGERIDO = 3;

/**
 * Cadastro de produto em popup, com os campos que o tipo pede e mais nenhum.
 *
 * O tipo so e escolhido na criacao. Trocar o tipo de um produto ja vendido nao
 * tem resposta boa: os itens antigos guardam o retrato do que foi vendido, e o
 * produto passaria a contradizer o proprio historico.
 */
export function ModalProduto({
  aberto,
  aoFechar,
  produto,
}: {
  aberto: boolean;
  aoFechar: () => void;
  produto?: ProdutoEditavel;
}) {
  const [estado, acao, salvando] = useActionState<EstadoProduto, FormData>(salvarProduto, {});
  const [estadoRemocao, acaoRemocao, removendo] = useActionState<EstadoProduto, FormData>(
    removerProduto,
    {},
  );

  const [tipo, setTipo] = useState<TipoProduto>(produto?.tipo ?? "avaliacao");
  const [foto, setFoto] = useState<string | null>(produto?.foto_url ?? null);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);

  const avaliacao = tipo === "avaliacao";
  const medidas = produto?.produto_avaliacao;

  // Removido o produto, nao ha mais o que editar atras da confirmacao.
  useAoDarCerto(estadoRemocao, aoFechar);

  return (
    <>
      {/* O popup do cadastro fica montado atras da confirmacao, e nao e trocado
          por ela: quem desistir de remover volta com o formulario do jeito que
          deixou, e nao com os campos recarregados do zero. */}
      <ModalDeFormulario
        aberto={aberto}
        aoFechar={aoFechar}
        titulo={produto ? produto.nome : "Novo produto"}
        descricao={
          produto
            ? `${ROTULO_TIPO_PRODUTO[tipo]} · o tipo não muda depois do cadastro.`
            : undefined
        }
        tamanho="largo"
        acao={acao}
        estado={estado}
        pendente={salvando}
        salvarRotulo={produto ? "Salvar produto" : "Cadastrar produto"}
        acaoSecundaria={
          produto ? (
            <Botao
              type="button"
              variante="fantasma"
              onClick={() => setConfirmandoRemocao(true)}
              disabled={salvando}
            >
              <Trash2 size={16} aria-hidden />
              Remover
            </Botao>
          ) : undefined
        }
      >
        {produto ? <input type="hidden" name="id" value={produto.id} /> : null}
        <input type="hidden" name="tipo" value={tipo} />

        {produto ? null : (
          <Escolha
            titulo="Tipo de produto"
            opcoes={TIPOS.map((valor) => ({
              valor,
              rotulo: ROTULO_TIPO_PRODUTO[valor],
              detalhe: DETALHE_DO_TIPO[valor],
            }))}
            selecionado={tipo}
            aoSelecionar={setTipo}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            rotulo="Código"
            name="codigo"
            placeholder="A5"
            defaultValue={produto?.codigo}
            required
            ajuda="Curto, aparece no pedido."
          />
          <Campo
            rotulo="Nome"
            name="nome"
            placeholder="Display A5"
            defaultValue={produto?.nome}
            required
          />
          <Campo
            rotulo="Valor"
            name="preco"
            inputMode="decimal"
            placeholder="79,00"
            defaultValue={produto ? reais(produto.preco_centavos) : ""}
            required
          />
          <Campo
            rotulo="Comissão (%)"
            name="comissao"
            inputMode="decimal"
            placeholder="10"
            defaultValue={produto ? numero(produto.comissao_percentual) : "0"}
            required
            ajuda="Quanto o vendedor ganha por venda."
          />
          <Campo
            rotulo="Prazo de entrega (dias)"
            name="prazo"
            type="number"
            min={0}
            max={365}
            placeholder="3"
            defaultValue={produto?.prazo_entrega_dias ?? PRAZO_SUGERIDO}
            required
            ajuda="O pedido sai quando o item mais lento fica pronto."
          />
          <label className="flex items-center gap-2 self-end pb-2.5 text-sm font-medium text-tinta">
            <input
              type="checkbox"
              name="ativo"
              defaultChecked={produto?.ativo ?? true}
              className="size-4 accent-marca"
            />
            Ativo na venda
          </label>
        </div>

        <CampoTexto
          rotulo="Descrição"
          name="descricao"
          placeholder="Camiseta em algodão, tamanhos P ao GG."
          defaultValue={produto?.descricao ?? ""}
          required={!avaliacao}
          ajuda={
            avaliacao
              ? "Opcional. A arte já mostra ao cliente o que ele leva."
              : "É o que o cliente lê para entender o que está comprando."
          }
        />

        {avaliacao ? (
          <fieldset className="border-t border-borda pt-4">
            <legend className="mb-3 text-xs font-semibold tracking-wide text-tinta-suave uppercase">
              Medidas da placa
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                rotulo="Largura (mm)"
                name="largura"
                inputMode="decimal"
                placeholder="150"
                defaultValue={medidas ? numero(medidas.largura_mm) : ""}
                required
              />
              <Campo
                rotulo="Altura (mm)"
                name="altura"
                inputMode="decimal"
                placeholder="212"
                defaultValue={medidas ? numero(medidas.altura_mm) : ""}
                required
              />
              <Campo
                rotulo="Margem de segurança (mm)"
                name="margem"
                inputMode="decimal"
                placeholder="7"
                defaultValue={medidas ? numero(medidas.margem_seguranca_mm) : "7"}
                required
                ajuda="Área que a arte não invade."
              />
              <Campo
                rotulo="Sangria (mm)"
                name="sangria"
                inputMode="decimal"
                placeholder="0"
                defaultValue={medidas ? numero(medidas.sangria_mm) : "0"}
                required
                ajuda="O que a gráfica apara."
              />
              <Campo
                rotulo="DPI"
                name="dpi"
                type="number"
                min={72}
                max={1200}
                placeholder="300"
                defaultValue={medidas?.dpi ?? 300}
                required
              />
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Marcadores
                titulo="Cores oferecidas"
                nome="cores"
                opcoes={CORES.map((valor) => ({ valor, rotulo: ROTULO_COR[valor] }))}
                marcados={medidas?.cores ?? CORES}
              />
              <Marcadores
                titulo="Tecnologias oferecidas"
                nome="tecnologias"
                opcoes={TECNOLOGIAS.map((valor) => ({ valor, rotulo: ROTULO_TECNOLOGIA[valor] }))}
                marcados={medidas?.tecnologias ?? TECNOLOGIAS}
              />
            </div>
          </fieldset>
        ) : (
          <FotoDoProduto foto={foto} aoTrocar={setFoto} fotoAtual={produto?.foto_url ?? null} />
        )}
      </ModalDeFormulario>

      {produto ? (
        <Confirmacao
          aberto={confirmandoRemocao}
          aoFechar={() => setConfirmandoRemocao(false)}
          titulo={`Remover ${produto.nome}?`}
          mensagem="O produto sai do catálogo para sempre. Se ele já foi vendido, o sistema não deixa apagar: desmarque “Ativo na venda” para tirá-lo da tela de venda sem perder o histórico."
          acao={acaoRemocao}
          estado={estadoRemocao}
          pendente={removendo}
          confirmarRotulo="Remover produto"
          carregandoTexto="Removendo..."
          ocultos={{ id: produto.id }}
        />
      ) : null}
    </>
  );
}

/** Lista de caixas de marcar, para os eixos que a placa oferece na venda. */
function Marcadores<T extends string>({
  titulo,
  nome,
  opcoes,
  marcados,
}: {
  titulo: string;
  nome: string;
  opcoes: Array<{ valor: T; rotulo: string }>;
  marcados: T[];
}) {
  return (
    <div>
      <p className="mb-2 text-rotulo font-medium text-tinta">{titulo}</p>
      <div className="flex flex-col gap-2">
        {opcoes.map((opcao) => (
          <label key={opcao.valor} className="flex items-center gap-2 text-sm text-tinta">
            <input
              type="checkbox"
              name={nome}
              value={opcao.valor}
              defaultChecked={marcados.includes(opcao.valor)}
              className="size-4 accent-marca"
            />
            {opcao.rotulo}
          </label>
        ))}
      </div>
    </div>
  );
}

function numero(valor: number): string {
  return String(Number(valor)).replace(".", ",");
}

function reais(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}
