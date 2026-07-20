import { NextResponse } from "next/server";

/**
 * Proxy simples para /health/ready da API. Mantém a chamada no mesmo
 * origin do browser (evita configuração de CORS na Web) e centraliza
 * o endereço da API em uma única variável de ambiente do lado do servidor.
 *
 * Importante: usa `API_URL` (sem prefixo `NEXT_PUBLIC_`) de propósito. Next.js
 * faz *inline* de qualquer `process.env.NEXT_PUBLIC_*` em tempo de build —
 * inclusive em código server-only como este route handler — então um valor
 * com esse prefixo ficaria congelado com o padrão usado no build da imagem
 * Docker e nunca refletiria o `http://api:3001` injetado em runtime pelo
 * compose. Variáveis sem esse prefixo são lidas ao vivo de `process.env` a
 * cada request no servidor, que é o que este caso precisa.
 */
export async function GET() {
  const apiUrl = process.env.API_URL ?? "http://localhost:3001";
  try {
    const response = await fetch(`${apiUrl}/health/ready`, { cache: "no-store" });
    const body = await response.json();
    return NextResponse.json(body, { status: response.status });
  } catch {
    return NextResponse.json({ status: "error", message: "API unreachable" }, { status: 503 });
  }
}
