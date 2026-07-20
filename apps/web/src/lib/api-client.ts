const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const CSRF_COOKIE_NAME = "morpheus_csrf_token";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
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

/**
 * Chama a API diretamente do browser (não via proxy da Web) com
 * `credentials: "include"` — necessário para o cookie httpOnly do refresh
 * token ir e voltar. Funciona sem CORS extra porque localhost:3000 e
 * localhost:3001 são portas do mesmo "site" (SameSite considera só o domínio
 * registrável, não a porta).
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit & { accessToken?: string } = {},
): Promise<T> {
  const { accessToken, headers, ...rest } = options;
  const csrfToken = readCsrfToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.message ?? `Erro ${response.status}`, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
