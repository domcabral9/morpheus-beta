const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const CSRF_COOKIE_NAME = "morpheus_csrf_token";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    // Código estável opcional (ex.: "AREA_BLOCKED") pra telas que precisam
    // distinguir um erro específico sem dar match na mensagem em português.
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Lê o cookie CSRF (não-httpOnly de propósito — ver AuthController no
 * backend) para reenviá-lo como header. Double-submit cookie: só provamos
 * que fomos nós quem fez a chamada porque só JS same-site consegue ler este
 * valor via document.cookie.
 */
function readCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

type FetchOptions = RequestInit & { accessToken?: string };

/** Monta headers/credentials comuns a `apiFetch`/`apiFetchBlob` — única fonte da lógica de
 * auth/CSRF, pra nunca divergir entre as duas variantes. Quando `body` é `FormData` (upload
 * multipart), não força `Content-Type: application/json` - o browser precisa definir o seu
 * próprio boundary, e forçar o header aqui quebraria o upload. */
function buildRequestInit(options: FetchOptions): RequestInit {
  const { accessToken, headers, ...rest } = options;
  const csrfToken = readCsrfToken();
  const isFormData = typeof FormData !== "undefined" && rest.body instanceof FormData;

  return {
    ...rest,
    credentials: "include",
    headers: {
      ...(rest.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...headers,
    },
  };
}

async function throwIfError(response: Response): Promise<void> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.message ?? `Erro ${response.status}`, response.status, body.error);
  }
}

/**
 * Chama a API diretamente do browser (não via proxy da Web) com
 * `credentials: "include"` — necessário para o cookie httpOnly do refresh
 * token ir e voltar. Funciona sem CORS extra porque localhost:3000 e
 * localhost:3001 são portas do mesmo "site" (SameSite considera só o domínio
 * registrável, não a porta).
 */
export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, buildRequestInit(options));
  await throwIfError(response);

  if (response.status === 204) {
    return undefined as T;
  }

  // Handlers que retornam void (ex.: remoção de opção, desvínculo de
  // controle) não têm @HttpCode(204) explícito — o Nest responde 200 com
  // corpo vazio. `response.json()` direto lançaria em cima de string vazia.
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Variante binária de `apiFetch` — pra respostas tipo imagem/PDF, onde `response.text()` +
 * `JSON.parse` corromperia os bytes. Mesma lógica de auth/CSRF/erro, só o corpo de sucesso muda. */
export async function apiFetchBlob(path: string, options: FetchOptions = {}): Promise<Blob> {
  const response = await fetch(`${API_URL}${path}`, buildRequestInit(options));
  await throwIfError(response);
  return response.blob();
}
