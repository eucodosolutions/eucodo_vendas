/**
 * Tipos do banco escritos a mao, espelhando `supabase/migrations/`.
 *
 * O projeto nao usa Docker, entao nao existe `gen types --local`. Quando o
 * projeto remoto estiver de pe, este arquivo pode ser substituido pela saida de
 * `supabase gen types typescript --linked`. Ate la, quem mexe na migration mexe
 * aqui tambem.
 */

export type PapelUsuario = "admin" | "assinante" | "vendedor";
export type StatusUsuario = "pendente" | "ativo" | "bloqueado";
export type StatusAssinatura = "pendente" | "ativa" | "suspensa" | "cancelada";
export type CorArte = "branco" | "preto";
export type TecnologiaArte = "qr" | "qr_nfc";
export type TipoProduto = "avaliacao" | "padrao";
export type StatusPedido = "novo" | "em_producao" | "pronto" | "entregue" | "cancelado";
export type StatusPagamento = "pendente" | "pago";
export type FormaPagamento =
  | "pix"
  | "dinheiro"
  | "cartao_credito"
  | "cartao_debito"
  | "transferencia";
export type OrigemPedido = "painel" | "publico";
export type ViaMensagem = "uazapi" | "link";

export type Assinatura = {
  id: string;
  nome: string;
  status: StatusAssinatura;
  criado_em: string;
  atualizado_em: string;
};

export type Perfil = {
  id: string;
  nome: string;
  email: string;
  whatsapp: string | null;
  papel: PapelUsuario;
  status: StatusUsuario;
  /** Conta a que a pessoa pertence. Nulo so no admin da plataforma. */
  assinatura_id: string | null;
  senha_temporaria: boolean;
  criado_em: string;
  atualizado_em: string;
};

/**
 * O que todo produto tem, seja placa ou nao.
 *
 * `tipo` e escolhido no cadastro e nao muda depois: trocar o tipo de um produto
 * ja vendido deixaria os itens antigos sem resposta.
 */
export type Produto = {
  id: string;
  assinatura_id: string;
  tipo: TipoProduto;
  codigo: string;
  nome: string;
  descricao: string | null;
  /** So no tipo padrao. A imagem da placa e a arte gerada no pedido. */
  foto_path: string | null;
  preco_centavos: number;
  comissao_percentual: number;
  prazo_entrega_dias: number;
  ativo: boolean;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
};

/** O que so a placa de avaliacao tem: medidas e o que ela oferece na venda. */
export type ProdutoAvaliacao = {
  produto_id: string;
  assinatura_id: string;
  largura_mm: number;
  altura_mm: number;
  margem_seguranca_mm: number;
  sangria_mm: number;
  dpi: number;
  cores: CorArte[];
  tecnologias: TecnologiaArte[];
};

export type Cliente = {
  id: string;
  assinatura_id: string;
  nome: string;
  whatsapp: string;
  google_place_id: string | null;
  link_avaliacao: string | null;
  observacoes: string | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type Pedido = {
  id: string;
  numero: number;
  codigo: string;
  assinatura_id: string;
  cliente_id: string;
  total_centavos: number;
  status: StatusPedido;
  pagamento: StatusPagamento;
  forma_pagamento: FormaPagamento | null;
  pago_em: string | null;
  cancelado_em: string | null;
  motivo_cancelamento: string | null;
  /** O maior prazo entre os itens: e quando o pedido inteiro sai. */
  prazo_entrega_dias: number;
  /** Valor a repassar, carimbado no dia da venda. */
  comissao_centavos: number;
  comissao_paga_em: string | null;
  origem: OrigemPedido;
  criado_por: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
};

/**
 * Uma linha do pedido, e o retrato do produto no dia da venda.
 *
 * `nome_negocio` mora aqui, e nao no pedido, porque duas placas do mesmo pedido
 * podem ser de empresas diferentes. O cliente que paga fica no pedido.
 *
 * Os quatro campos de placa sao nulos em produto do tipo padrao, e o banco
 * cobra essa coerencia no check `item_coerente_com_o_tipo`.
 */
export type PedidoItem = {
  id: string;
  pedido_id: string;
  ordem: number;
  produto_id: string;
  tipo: TipoProduto;
  nome_negocio: string | null;
  link_avaliacao: string | null;
  google_place_id: string | null;
  produto_codigo: string;
  produto_nome: string;
  cor: CorArte | null;
  tecnologia: TecnologiaArte | null;
  quantidade: number;
  preco_unitario_centavos: number;
  total_centavos: number;
  prazo_entrega_dias: number;
  comissao_percentual: number;
  comissao_centavos: number;
  arte_jpg_path: string | null;
  arte_preview_path: string | null;
  criado_em: string;
};

export type PedidoEvento = {
  id: string;
  pedido_id: string;
  tipo: string;
  de: string | null;
  para: string | null;
  detalhe: string | null;
  autor_id: string | null;
  criado_em: string;
};

export type ModeloMensagem = {
  id: string;
  chave: string;
  descricao: string;
  corpo: string;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
};

export type MensagemWhatsapp = {
  id: string;
  pedido_id: string | null;
  destino: string;
  chave_modelo: string | null;
  corpo: string;
  tem_midia: boolean;
  via: ViaMensagem;
  sucesso: boolean;
  resposta: unknown;
  erro: string | null;
  criado_em: string;
};

export type InstanciaWhatsapp = {
  id: string;
  rotulo: string;
  host: string;
  /** Id do segredo no Vault. O token em si nunca sai do banco. */
  token_secreto_id: string;
  ativo: boolean;
  observacao: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type Configuracoes = {
  assinatura_id: string;
  instancia_id: string | null;
  pix_chave: string | null;
  pix_beneficiario: string | null;
  pix_cidade: string | null;
  prazo_producao_dias: number;
  atualizado_em: string;
};

type Tabela<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      assinaturas: Tabela<Assinatura>;
      perfis: Tabela<Perfil, Pick<Perfil, "id" | "nome" | "email"> & Partial<Perfil>>;
      produtos: Tabela<
        Produto,
        Pick<Produto, "assinatura_id" | "tipo" | "codigo" | "nome" | "preco_centavos"> &
          Partial<Produto>
      >;
      produto_avaliacao: Tabela<ProdutoAvaliacao>;
      clientes: Tabela<
        Cliente,
        Pick<Cliente, "assinatura_id" | "nome" | "whatsapp"> & Partial<Cliente>
      >;
      // Total e comissao ficam de fora do Insert: quem calcula os dois e o
      // gatilho `recalcular_pedido`, a partir dos itens.
      pedidos: Tabela<
        Pedido,
        Pick<Pedido, "assinatura_id" | "cliente_id" | "criado_por"> & Partial<Pedido>
      >;
      // A comissao fica de fora do Insert: quem carimba os dois campos e o
      // gatilho `carimbar_item_do_pedido`, a partir do produto.
      pedido_itens: Tabela<
        PedidoItem,
        Omit<
          PedidoItem,
          "id" | "total_centavos" | "criado_em" | "comissao_percentual" | "comissao_centavos"
        > &
          Partial<Pick<PedidoItem, "id">>
      >;
      pedido_eventos: Tabela<PedidoEvento, Omit<PedidoEvento, "id" | "criado_em">>;
      modelos_mensagem: Tabela<ModeloMensagem>;
      mensagens_whatsapp: Tabela<MensagemWhatsapp, Omit<MensagemWhatsapp, "id" | "criado_em">>;
      instancias_whatsapp: Tabela<InstanciaWhatsapp>;
      configuracoes: Tabela<Configuracoes>;
    };
    Views: Record<string, never>;
    Functions: {
      minha_assinatura: { Args: Record<string, never>; Returns: string | null };
      usuario_ativo: { Args: Record<string, never>; Returns: boolean };
      usuario_admin: { Args: Record<string, never>; Returns: boolean };
      usuario_assinante: { Args: Record<string, never>; Returns: boolean };
      pedido_visivel: { Args: { p_pedido: string }; Returns: boolean };
      pedido_editavel: { Args: { p_pedido: string }; Returns: boolean };
      registrar_instancia_whatsapp: {
        Args: { p_rotulo: string; p_host: string; p_token: string; p_observacao?: string };
        Returns: string;
      };
      trocar_token_instancia: {
        Args: { p_instancia_id: string; p_token: string };
        Returns: undefined;
      };
      // token_da_instancia so executa com a chave de servico, dentro da Edge
      // Function. Fica de fora daqui de proposito, para nao virar tentacao.
    };
    Enums: {
      papel_usuario: PapelUsuario;
      status_usuario: StatusUsuario;
      status_assinatura: StatusAssinatura;
      cor_arte: CorArte;
      tecnologia_arte: TecnologiaArte;
      tipo_produto: TipoProduto;
      status_pedido: StatusPedido;
      status_pagamento: StatusPagamento;
      forma_pagamento: FormaPagamento;
      origem_pedido: OrigemPedido;
      via_mensagem: ViaMensagem;
    };
    CompositeTypes: Record<string, never>;
  };
};
