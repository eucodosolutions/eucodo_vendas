import { redirect } from "next/navigation";

export default function Raiz() {
  // A raiz nao tem conteudo proprio: quem tem sessao vai vender, quem nao tem
  // e desviado para o login pelo proxy.
  redirect("/vender");
}
