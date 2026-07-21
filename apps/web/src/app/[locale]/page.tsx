import { redirect } from "@/i18n/navigation";

/**
 * Sem landing separada — a raiz do site é a tela de login direto (decisão do
 * usuário: a landing anterior só mostrava título + um botão pequeno pra
 * chegar até aqui, sem valor próprio). Redirect de verdade, não uma página
 * que só parece login. `locale` é obrigatório na variante server-side do
 * `redirect` do next-intl (sem contexto de cliente pra inferir sozinho).
 */
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/login", locale });
}
