import { ROTULO_STATUS, ROTULO_STATUS_ASSINATURA } from "@/lib/formato";
import type { StatusAssinatura, StatusPagamento, StatusPedido } from "@/types/database";

const BASE =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

/**
 * Producao e pagamento sao duas trilhas, e por isso duas etiquetas. Um pedido
 * pode estar pronto e nao pago, e o painel precisa mostrar os dois de relance.
 */
const CORES_STATUS: Record<StatusPedido, string> = {
  novo: "bg-marca-suave text-marca",
  em_producao: "bg-atencao-suave text-atencao",
  pronto: "bg-sucesso-suave text-sucesso",
  entregue: "bg-papel text-tinta-media",
  cancelado: "bg-erro-suave text-erro",
};

export function EtiquetaStatus({ status }: { status: StatusPedido }) {
  return <span className={`${BASE} ${CORES_STATUS[status]}`}>{ROTULO_STATUS[status]}</span>;
}

export function EtiquetaPagamento({ pagamento }: { pagamento: StatusPagamento }) {
  const pago = pagamento === "pago";
  return (
    <span className={`${BASE} ${pago ? "bg-sucesso-suave text-sucesso" : "bg-papel text-tinta-media"}`}>
      {pago ? "Pago" : "A receber"}
    </span>
  );
}

/**
 * Estado da assinatura, no painel da plataforma.
 *
 * O rotulo vem junto da cor de proposito: quem nao distingue verde de laranja
 * ainda le "Pendente".
 */
const CORES_ASSINATURA: Record<StatusAssinatura, string> = {
  pendente: "bg-atencao-suave text-atencao",
  ativa: "bg-sucesso-suave text-sucesso",
  suspensa: "bg-erro-suave text-erro",
  cancelada: "bg-papel text-tinta-media",
};

export function EtiquetaAssinatura({ status }: { status: StatusAssinatura }) {
  return (
    <span className={`${BASE} ${CORES_ASSINATURA[status]}`}>
      {ROTULO_STATUS_ASSINATURA[status]}
    </span>
  );
}

/**
 * De quem e o cadastro, quando nao e de quem esta olhando.
 *
 * O dono da conta ve os clientes da conta inteira, os dele e os da equipe.
 * Sem a etiqueta as duas agendas viram uma lista so, e o mesmo WhatsApp
 * aparecendo duas vezes — o dele e o do vendedor — pareceria cadastro repetido
 * em vez de dois cadastros de donos diferentes.
 *
 * So o primeiro nome entra: a etiqueta anda ao lado do nome do cliente, que e
 * quem manda na linha, e "Cadastrado por Maria Aparecida da Silva" empurraria o
 * cliente para fora da tela no celular.
 */
export function EtiquetaDeAutor({ nome }: { nome: string }) {
  const primeiro = nome.trim().split(/\s+/)[0] || nome;

  return (
    <span className={`${BASE} bg-papel text-tinta-media`} title={`Cadastrado por ${nome}`}>
      Cadastrado por {primeiro}
    </span>
  );
}
