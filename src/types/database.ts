/**
 * Tipos do banco escritos a mao, espelhando `supabase/migrations/`.
 *
 * O projeto nao usa Docker, entao nao existe `gen types --local`. Quando o
 * projeto remoto estiver de pe, este arquivo pode ser substituido pela saida de
 * `supabase gen types typescript --linked`. Ate la, quem mexe na migration mexe
 * aqui tambem.
 */

export type PapelUsuario = "admin" | "vendedor";
export type StatusUsuario = "pendente" | "ativo" | "bloqueado";
export type CorArte = "branco" | "preto";
export type TecnologiaArte = "qr" | "qr_nfc";
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

export type Perfil = {
  id: string;
  nome: string;
  email: string;
  whatsapp: string | null;
  papel: PapelUsuario;
  status: StatusUsuario;
  criado_em: string;
  atualizado_em: string;
};

export type Tamanho = {
  id: string;
  codigo: string;
  rotulo: string;
  largura_mm: number;
  altura_mm: number;
  margem_seguranca_mm: number;
  sangria_mm: number;
  dpi: number;
  ordem: number;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
};

export type Variante = {
  id: string;
  tamanho_id: string;
  cor: CorArte;
  tecnologia: TecnologiaArte;
  preco_centavos: number;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
};

export type Pedido = {
  id: string;
  numero: number;
  codigo: string;
  variante_id: string;
  nome_negocio: string;
  whatsapp: string;
  link_avaliacao: string;
  google_place_id: string | null;
  tamanho_codigo: string;
  cor: CorArte;
  tecnologia: TecnologiaArte;
  quantidade: number;
  preco_unitario_centavos: number;
  total_centavos: number;
  status: StatusPedido;
  pagamento: StatusPagamento;
  forma_pagamento: FormaPagamento | null;
  pago_em: string | null;
  cancelado_em: string | null;
  motivo_cancelamento: string | null;
  arte_jpg_path: string | null;
  arte_preview_path: string | null;
  origem: OrigemPedido;
  criado_por: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
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
  id: boolean;
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
      perfis: Tabela<Perfil, Pick<Perfil, "id" | "nome" | "email"> & Partial<Perfil>>;
      tamanhos: Tabela<Tamanho>;
      variantes: Tabela<Variante>;
      pedidos: Tabela<
        Pedido,
        Omit<Pedido, "id" | "numero" | "codigo" | "criado_em" | "atualizado_em"> &
          Partial<Pick<Pedido, "id">>
      >;
      pedido_eventos: Tabela<PedidoEvento, Omit<PedidoEvento, "id" | "criado_em">>;
      modelos_mensagem: Tabela<ModeloMensagem>;
      mensagens_whatsapp: Tabela<MensagemWhatsapp, Omit<MensagemWhatsapp, "id" | "criado_em">>;
      instancias_whatsapp: Tabela<InstanciaWhatsapp>;
      configuracoes: Tabela<Configuracoes>;
    };
    Views: Record<string, never>;
    Functions: {
      usuario_ativo: { Args: Record<string, never>; Returns: boolean };
      usuario_admin: { Args: Record<string, never>; Returns: boolean };
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
      cor_arte: CorArte;
      tecnologia_arte: TecnologiaArte;
      status_pedido: StatusPedido;
      status_pagamento: StatusPagamento;
      forma_pagamento: FormaPagamento;
      origem_pedido: OrigemPedido;
      via_mensagem: ViaMensagem;
    };
    CompositeTypes: Record<string, never>;
  };
};
