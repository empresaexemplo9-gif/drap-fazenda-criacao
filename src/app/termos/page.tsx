import type { Metadata } from "next";
import { DocumentoLegal } from "@/components/documento-legal";

export const metadata: Metadata = { title: "Termos de Uso" };

export default function Page() {
  return <DocumentoLegal tipo="termos" />;
}
