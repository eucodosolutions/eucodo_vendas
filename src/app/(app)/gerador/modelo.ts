import type { Produto, ProdutoAvaliacao } from "@/types/database";

/**
 * A placa do catalogo do jeito que a bancada precisa dela.
 *
 * Mora em arquivo proprio, e nao na pagina, porque quem importa o tipo e o
 * componente de cliente: puxa-lo de `page.tsx` arrastaria o server component
 * inteiro — com o cliente do Supabase junto — para dentro do bundle do
 * navegador.
 */
export type ModeloDoGerador = {
  id: string;
  nome: Produto["nome"];
  produto_avaliacao: Pick<
    ProdutoAvaliacao,
    | "largura_mm"
    | "altura_mm"
    | "margem_seguranca_mm"
    | "sangria_mm"
    | "dpi"
    | "cores"
    | "tecnologia"
  >;
};
