import type { ReactNode } from "react";

type AlertaProps = {
  tom: "erro" | "sucesso" | "atencao";
  children: ReactNode;
};

const ESTILOS = {
  erro: "bg-erro-suave text-erro",
  sucesso: "bg-sucesso-suave text-sucesso",
  atencao: "bg-atencao-suave text-atencao",
} as const;

export function Alerta({ tom, children }: AlertaProps) {
  return (
    <p
      role={tom === "erro" ? "alert" : "status"}
      className={`rounded-lg px-3.5 py-3 text-sm font-medium ${ESTILOS[tom]}`}
    >
      {children}
    </p>
  );
}
