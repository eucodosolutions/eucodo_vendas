"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { AcoesDoVendedor } from "./acoes-do-vendedor";
import { ModalNovoVendedor } from "./modal-novo-vendedor";
import { Botao } from "@/components/ui/botao";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Secao } from "@/components/ui/secao";
import { moeda, whatsappLegivel } from "@/lib/formato";

export type VendedorDaLista = {
  id: string;
  nome: string;
  email: string;
  whatsapp: string | null;
  senha_temporaria: boolean;
  aReceber: number;
  prevista: number;
  acertada: number;
  pedidos: number;
};

export function ListaDaEquipe({ equipe }: { equipe: VendedorDaLista[] }) {
  const [cadastrando, setCadastrando] = useState(false);
  const [rodada, setRodada] = useState(0);

  // Fechar o popup nao basta: o `useActionState` dele guarda o acesso do
  // vendedor recem-criado, e reabrir sem remontar mostraria a senha do anterior
  // no lugar do formulario. A `key` nova joga esse estado fora.
  function fecharCadastro() {
    setCadastrando(false);
    setRodada((valor) => valor + 1);
  }

  const botaoDeAdicionar = (
    <Botao type="button" onClick={() => setCadastrando(true)}>
      <Plus size={16} aria-hidden />
      Novo vendedor
    </Botao>
  );

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoDePagina
        titulo="Equipe"
        descricao="A comissão é definida por produto: cada um paga o percentual dele, e o valor fica registrado no pedido no dia da venda."
        acao={botaoDeAdicionar}
      />

      {equipe.length === 0 ? (
        <EstadoVazio
          mensagem="Nenhum vendedor cadastrado ainda."
          acao={
            <Botao type="button" onClick={() => setCadastrando(true)}>
              Cadastrar o primeiro
            </Botao>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {equipe.map((vendedor) => (
            <Secao key={vendedor.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-base font-medium text-tinta">{vendedor.nome}</p>
                  <p className="text-sm break-all text-tinta-suave">
                    {vendedor.email}
                    {vendedor.whatsapp ? ` | ${whatsappLegivel(vendedor.whatsapp)}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-tinta-suave">
                    {vendedor.senha_temporaria
                      ? "Ainda não trocou a senha provisória."
                      : `${vendedor.pedidos} pedido${vendedor.pedidos === 1 ? "" : "s"} com comissão`}
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <p className="text-xs font-medium tracking-wide text-tinta-suave uppercase">
                    A receber
                  </p>
                  <p className="text-xl font-semibold text-tinta tabular-nums">
                    {moeda(vendedor.aReceber)}
                  </p>
                  <p className="text-xs text-tinta-suave tabular-nums">
                    {moeda(vendedor.prevista)} a caminho, {moeda(vendedor.acertada)} já acertado
                  </p>
                </div>
              </div>

              <div className="mt-4 border-t border-borda pt-4">
                <AcoesDoVendedor
                  nome={vendedor.nome}
                  vendedorId={vendedor.id}
                  aReceberCentavos={vendedor.aReceber}
                />
              </div>
            </Secao>
          ))}
        </div>
      )}

      <ModalNovoVendedor key={rodada} aberto={cadastrando} aoFechar={fecharCadastro} />
    </div>
  );
}
