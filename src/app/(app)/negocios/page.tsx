import type { Metadata } from "next";

import { BotaoNovoNegocio } from "./botao-novo-negocio";
import { EtiquetaDeAutor } from "@/components/etiquetas";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { CampoDeBusca } from "@/components/ui/campo-de-busca";
import { CartaoDeLista } from "@/components/ui/cartao-de-lista";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { dataHora } from "@/lib/formato";
import { sessaoDoPainel } from "@/lib/supabase/painel";
import { createClient } from "@/lib/supabase/server";
import type { Negocio } from "@/types/database";

export const metadata: Metadata = { title: "Negocios" };

type LinhaNegocio = Pick<
  Negocio,
  "id" | "nome" | "endereco" | "criado_em" | "criado_por"
> & {
  autor: { nome: string } | null;
};

export default async function PaginaNegocios({ searchParams }: PageProps<"/negocios">) {
  const { busca } = await searchParams;
  const termo = typeof busca === "string" ? busca.trim() : "";

  const supabase = await createClient();
  const sessao = await sessaoDoPainel();

  let consulta = supabase
    .from("negocios")
    // O autor vem junto porque a lista do dono da conta mistura a rota dele com
    // a da equipe. A RLS ja limita o que cada um enxerga; o nome aqui e so para
    // a etiqueta dizer de quem e o cadastro.
    .select("id, nome, endereco, criado_em, criado_por, autor:perfis (nome)")
    // Pelo mais recente, e nao pelo nome: quem abre esta tela acabou de montar
    // a rota de amanha, e e ela que precisa estar em cima.
    .order("criado_em", { ascending: false })
    .limit(200);

  if (termo) {
    // Virgula e parentese sao a sintaxe do filtro `or` do PostgREST: deixar
    // passar o que a pessoa digitou seria deixar ela reescrever a consulta.
    const limpo = termo.replace(/[,()*]/g, " ").trim();
    if (limpo) consulta = consulta.or(`nome.ilike.%${limpo}%,endereco.ilike.%${limpo}%`);
  }

  const { data } = await consulta.returns<LinhaNegocio[]>();
  const negocios = data ?? [];
  const ehVendedor = sessao?.perfil.papel === "vendedor";

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoDePagina
        titulo="Negócios"
        descricao={
          ehVendedor
            ? "Os negócios que você cadastrou. Monte aqui a rota de amanhã."
            : "Todos os negócios da sua conta, seus e da sua equipe."
        }
        acao={<BotaoNovoNegocio />}
      />

      <form>
        <CampoDeBusca
          rotulo="Buscar negócio"
          placeholder="Buscar por nome ou endereço"
          defaultValue={termo}
        />
      </form>

      {negocios.length === 0 ? (
        <EstadoVazio
          mensagem={
            termo
              ? "Nenhum negócio com esse nome ou endereço."
              : "Cadastre os negócios por onde você vai passar e chegue com o link pronto."
          }
          acao={termo ? undefined : <BotaoNovoNegocio rotulo="Cadastrar o primeiro" />}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {negocios.map((negocio) => (
            <li key={negocio.id}>
              <CartaoDeLista href={`/negocios/${negocio.id}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-base font-medium text-tinta">{negocio.nome}</p>
                    {/* So aparece no cadastro que nao e de quem esta olhando. O
                        vendedor ve apenas os proprios negocios, entao para ele
                        a etiqueta nunca acende. */}
                    {negocio.criado_por && negocio.criado_por !== sessao?.perfil.id ? (
                      <EtiquetaDeAutor nome={negocio.autor?.nome ?? "alguém da equipe"} />
                    ) : null}
                  </div>
                  {negocio.endereco ? (
                    <p className="truncate text-sm text-tinta-suave">{negocio.endereco}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs text-tinta-suave tabular-nums">
                  {dataHora(negocio.criado_em)}
                </span>
              </CartaoDeLista>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
