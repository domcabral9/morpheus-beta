import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";
import {
  PrismaClient,
  RiskDimension,
  QuestionType,
  ControlFrameworkCode,
} from "../generated/client";

// `tsx prisma/seed.ts` pode ser chamado diretamente (via `pnpm seed`) ou como
// subprocesso do `prisma migrate dev` — carregamos o .env explicitamente para
// funcionar nos dois casos, sem depender do processo pai já ter injetado.
loadEnv({ path: path.resolve(__dirname, "../../../.env") });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// -----------------------------------------------------------------------------
// Seed de configuração (Etapa 2): tenant demo, RBAC, questionário, biblioteca
// de controles, matriz de risco padrão, recomendações e fluxo de aprovação
// padrão. Não cria nenhuma Assessment de exemplo — isso é melhor feito pela
// camada de serviço (Etapa 4) para não duplicar as regras de negócio
// (cálculo de score, criação de versão, etc.) diretamente no seed.
// -----------------------------------------------------------------------------

const PERMISSIONS = [
  { key: "users:manage", description: "Gerenciar usuários do tenant" },
  { key: "roles:manage", description: "Gerenciar papéis e permissões" },
  { key: "questions:manage", description: "Gerenciar perguntas do questionário" },
  { key: "risk-matrix:manage", description: "Gerenciar a matriz de risco" },
  { key: "workflows:manage", description: "Gerenciar fluxos de aprovação" },
  { key: "system:configure", description: "Configurar parâmetros globais do sistema" },
  { key: "assessments:create", description: "Criar avaliações" },
  { key: "assessments:edit-own", description: "Editar as próprias avaliações enquanto abertas" },
  { key: "assessments:view-own", description: "Visualizar as próprias avaliações" },
  { key: "assessments:view-all", description: "Visualizar todas as avaliações do tenant" },
  { key: "assessments:submit", description: "Enviar avaliação para análise" },
  { key: "assessments:approve", description: "Aprovar ou reprovar etapas do workflow" },
  { key: "assessments:reopen", description: "Reabrir uma avaliação já concluída" },
  { key: "assessments:export-any", description: "Exportar o PDF de qualquer avaliação" },
  { key: "reports:export-own", description: "Exportar o PDF das próprias avaliações" },
  { key: "inventory:view", description: "Visualizar o inventário de softwares" },
  { key: "inventory:manage", description: "Gerenciar itens do inventário de softwares" },
] as const;

const ADMIN_PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);
const USER_PERMISSION_KEYS = [
  "assessments:create",
  "assessments:edit-own",
  "assessments:view-own",
  "assessments:submit",
  "reports:export-own",
  "inventory:view",
];
const APPROVER_PERMISSION_KEYS = ["assessments:approve", "assessments:view-all", "inventory:view"];

const QUESTION_CATEGORIES = [
  "Informações Gerais",
  "Segurança",
  "Privacidade",
  "LGPD",
  "Infraestrutura",
  "Continuidade",
  "Backup",
  "Gestão de Acessos",
  "Integrações",
  "Dados Sensíveis",
];

// Entidade normalizada (não texto livre) — ver comentário no schema sobre o
// modelo Area. Lista de departamentos comuns o suficiente para servir de
// base real ao ranking de maturidade/adesão por área (gamificação, Etapa 9).
const AREAS = [
  "Tecnologia da Informação",
  "Segurança da Informação",
  "Recursos Humanos",
  "Financeiro",
  "Jurídico",
  "Marketing",
  "Operações",
];

const CONTROL_FRAMEWORKS: Array<{ code: ControlFrameworkCode; name: string }> = [
  { code: "ISO_27001", name: "ISO/IEC 27001:2022" },
  { code: "ISO_27002", name: "ISO/IEC 27002" },
  { code: "NIST_CSF", name: "NIST Cybersecurity Framework (CSF 2.0)" },
  { code: "CIS_V8", name: "CIS Controls v8" },
  { code: "LGPD", name: "Lei Geral de Proteção de Dados" },
  { code: "GDPR", name: "General Data Protection Regulation" },
  { code: "OWASP_ASVS", name: "OWASP Application Security Verification Standard" },
  { code: "OWASP_TOP10", name: "OWASP Top 10" },
];

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {},
    create: { name: "Empresa Demo", slug: "demo" },
  });

  // --- Áreas/departamentos -----------------------------------------------------
  await Promise.all(
    AREAS.map((name) =>
      prisma.area.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name } },
        update: {},
        create: { tenantId: tenant.id, name },
      }),
    ),
  );

  // --- Permissões (catálogo global) -----------------------------------------
  await Promise.all(
    PERMISSIONS.map((permission) =>
      prisma.permission.upsert({
        where: { key: permission.key },
        update: { description: permission.description },
        create: permission,
      }),
    ),
  );
  const allPermissions = await prisma.permission.findMany();
  const permissionByKey = new Map(allPermissions.map((p) => [p.key, p]));

  // --- Papéis do tenant -------------------------------------------------------
  const roleDefs = [
    { name: "Administrador", permissionKeys: ADMIN_PERMISSION_KEYS },
    { name: "Usuário", permissionKeys: USER_PERMISSION_KEYS },
    { name: "Gestor da Área", permissionKeys: APPROVER_PERMISSION_KEYS },
    { name: "Segurança da Informação", permissionKeys: APPROVER_PERMISSION_KEYS },
    { name: "DPO", permissionKeys: APPROVER_PERMISSION_KEYS },
    { name: "Jurídico", permissionKeys: APPROVER_PERMISSION_KEYS },
  ];

  const roleByName = new Map<string, { id: string }>();
  for (const roleDef of roleDefs) {
    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: roleDef.name } },
      update: {},
      create: { tenantId: tenant.id, name: roleDef.name, isSystem: true },
    });
    roleByName.set(roleDef.name, role);

    for (const key of roleDef.permissionKeys) {
      const permission = permissionByKey.get(key);
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  // --- Usuários demo -----------------------------------------------------------
  // Senha só para os dois usuários de demonstração — NUNCA usar esse padrão
  // para provisionar usuários reais (a Etapa 3 só usa isso no seed; criação
  // de usuário via API sempre gera hash a partir de senha informada pelo
  // próprio usuário).
  const DEMO_PASSWORD = "Demo@12345";
  const demoPasswordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "admin@morpheus.demo" } },
    update: { passwordHash: demoPasswordHash },
    create: {
      tenantId: tenant.id,
      name: "Administrador Demo",
      email: "admin@morpheus.demo",
      passwordHash: demoPasswordHash,
    },
  });
  const demoUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "usuario@morpheus.demo" } },
    update: { passwordHash: demoPasswordHash },
    create: {
      tenantId: tenant.id,
      name: "Usuário Demo",
      email: "usuario@morpheus.demo",
      passwordHash: demoPasswordHash,
    },
  });

  const adminRole = roleByName.get("Administrador")!;
  const userRole = roleByName.get("Usuário")!;
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: demoUser.id, roleId: userRole.id } },
    update: {},
    create: { userId: demoUser.id, roleId: userRole.id },
  });

  // --- Categorias e perguntas do questionário ----------------------------------
  const categoryByName = new Map<string, { id: string }>();
  for (const [index, name] of QUESTION_CATEGORIES.entries()) {
    const category = await prisma.questionCategory.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: {},
      create: { tenantId: tenant.id, name, order: index },
    });
    categoryByName.set(name, category);
  }

  type SeedQuestion = {
    category: string;
    text: string;
    description?: string;
    weight: number;
    type: QuestionType;
    riskDimension: RiskDimension;
    isRequired?: boolean;
    options: Array<{ label: string; value: string; score: number }>;
  };

  const YES_NO = (yesScore: number, noScore: number) => [
    { label: "Sim", value: "yes", score: yesScore },
    { label: "Não", value: "no", score: noScore },
  ];

  // Perguntas reais do processo paralelo em Google Forms ("SecOps - Softwares
  // Homologados"), fornecidas pelo usuário. Nome, versão, área responsável,
  // responsável técnico e criticidade do formulário original NÃO viram
  // pergunta aqui — já são campos estruturados em Assessment (permitem
  // filtrar/consultar sem parsear texto livre; ver decisão na Etapa 4).
  // Opções de múltipla escolha são valores de mercado razoáveis — ainda não
  // são as opções reais do formulário (o usuário vai enviar depois) — ajuste
  // pelo CRUD administrativo (/questionnaire/admin/*), não editando este seed.
  // Scores de opção na escala 0-5 (0 = sem risco, 5 = risco máximo) — mesma
  // escala usada pelo motor de risco (Etapa 5) para o score final 1-5,
  // alinhado ao processo já em produção da empresa (n8n: Homologado 4.0-5.0,
  // Aguardando Ajustes 3.0-3.9, Rejeitado <3.0).
  const seedQuestions: SeedQuestion[] = [
    {
      category: "Informações Gerais",
      text: "Selecione a CATEGORIA que o Software se enquadra",
      weight: 3,
      type: "SINGLE_CHOICE",
      riskDimension: "PROBABILITY",
      options: [
        { label: "ERP", value: "erp", score: 1 },
        { label: "CRM", value: "crm", score: 1 },
        { label: "Ferramenta de produtividade", value: "productivity", score: 0.5 },
        { label: "Comunicação/colaboração", value: "communication", score: 1 },
        { label: "Segurança", value: "security", score: 1.5 },
        { label: "Desenvolvimento/DevOps", value: "devops", score: 1.5 },
        { label: "Design/criação", value: "design", score: 0.5 },
        { label: "Financeiro/contábil", value: "finance", score: 1.5 },
        { label: "Recursos Humanos", value: "hr", score: 1.5 },
        { label: "Business Intelligence/Analytics", value: "bi", score: 1 },
        { label: "Infraestrutura/monitoramento", value: "infra", score: 1.5 },
        { label: "Outro", value: "other", score: 2.5 },
      ],
    },
    {
      category: "Informações Gerais",
      text: "Escreva, em poucas palavras, qual a FINALIDADE do Software",
      weight: 2,
      type: "TEXT",
      riskDimension: "BOTH",
      options: [],
    },
    {
      category: "Informações Gerais",
      text: "Informe qual é o tipo de LICENCIAMENTO do Software Adquirido",
      weight: 3,
      type: "SINGLE_CHOICE",
      riskDimension: "PROBABILITY",
      options: [
        { label: "Gratuito", value: "free", score: 1 },
        { label: "Freemium", value: "freemium", score: 1.5 },
        { label: "Assinatura (SaaS)", value: "subscription", score: 1 },
        { label: "Licença perpétua", value: "perpetual", score: 1 },
        { label: "Open Source", value: "open_source", score: 1.5 },
        { label: "Trial/avaliação", value: "trial", score: 3 },
      ],
    },
    {
      category: "Informações Gerais",
      text: "Qual é o tipo de COBRANÇA",
      weight: 2,
      type: "SINGLE_CHOICE",
      riskDimension: "PROBABILITY",
      options: [
        { label: "Gratuito", value: "free", score: 0.5 },
        { label: "Mensal", value: "monthly", score: 0.5 },
        { label: "Anual", value: "yearly", score: 0.5 },
        { label: "Único (compra única)", value: "one_time", score: 0.5 },
        { label: "Por usuário/licença", value: "per_user", score: 0.5 },
        { label: "Por uso (pay-as-you-go)", value: "pay_as_you_go", score: 1 },
      ],
    },
    {
      category: "Informações Gerais",
      text: "Qual é a FONTE DE AQUISIÇÃO",
      description: "Como o software chegou até a empresa.",
      weight: 4,
      type: "SINGLE_CHOICE",
      riskDimension: "PROBABILITY",
      options: [
        { label: "Compra direta pela TI", value: "it_purchase", score: 0.5 },
        { label: "Compra por outra área (fora da TI)", value: "shadow_purchase", score: 4 },
        { label: "Doação/parceria", value: "donation", score: 2.5 },
        { label: "Desenvolvimento interno", value: "in_house", score: 1 },
        { label: "Já existente/legado", value: "legacy", score: 3 },
      ],
    },
    {
      category: "Informações Gerais",
      text: "Diga-nos qual é o CONTATO do responsável",
      weight: 1,
      type: "TEXT",
      riskDimension: "PROBABILITY",
      options: [],
    },
    {
      category: "Infraestrutura",
      text: "Onde o software será HOSPEDADO",
      weight: 5,
      type: "SINGLE_CHOICE",
      riskDimension: "PROBABILITY",
      options: [
        { label: "Nuvem pública (SaaS do fornecedor)", value: "vendor_saas", score: 2.5 },
        { label: "Nuvem própria da empresa (AWS/Azure/GCP/Magalu Cloud)", value: "company_cloud", score: 1.5 },
        { label: "Datacenter próprio (on-premises)", value: "on_prem", score: 1 },
        { label: "Notebook/desktop local", value: "local_device", score: 2 },
        { label: "Não sei informar", value: "unknown", score: 4 },
      ],
    },
    {
      category: "Gestão de Acessos",
      text: "Informe qual é o TIPO DE ACESSO",
      weight: 3,
      type: "SINGLE_CHOICE",
      riskDimension: "PROBABILITY",
      options: [
        { label: "Web (navegador)", value: "web", score: 1 },
        { label: "Aplicativo desktop instalado", value: "desktop_app", score: 1.5 },
        { label: "Aplicativo mobile", value: "mobile_app", score: 1.5 },
        { label: "API/integração apenas", value: "api_only", score: 2 },
        { label: "Múltiplos", value: "multiple", score: 2 },
      ],
    },
    {
      category: "Segurança",
      text: "O Software utiliza Múltiplo Fator de Autenticação (MFA)?",
      weight: 9,
      type: "SINGLE_CHOICE",
      riskDimension: "IMPACT",
      options: YES_NO(0, 4),
    },
    {
      category: "Segurança",
      text: "Caso exista Múltiplo Fator de Autenticação (MFA), como ele está implementado?",
      weight: 1,
      type: "TEXT",
      riskDimension: "IMPACT",
      isRequired: false,
      options: [],
    },
    {
      category: "Segurança",
      text: "O Software utiliza autenticação Single Sign-On (SSO)?",
      description: "SSO reduz risco (menos senhas isoladas espalhadas) — por isso 'Não' pesa mais aqui.",
      weight: 6,
      type: "SINGLE_CHOICE",
      riskDimension: "PROBABILITY",
      options: YES_NO(0.5, 2.5),
    },
    {
      category: "Segurança",
      text: "Caso exista Single Sign-On (SSO), como ele está implementado?",
      weight: 1,
      type: "TEXT",
      riskDimension: "PROBABILITY",
      isRequired: false,
      options: [],
    },
    {
      category: "Gestão de Acessos",
      text: "Qual é a FORMA DE ACESSO",
      weight: 3,
      type: "SINGLE_CHOICE",
      riskDimension: "PROBABILITY",
      options: [
        { label: "Somente rede interna/VPN", value: "internal_vpn", score: 0.5 },
        { label: "Acesso público pela internet", value: "public_internet", score: 3 },
        { label: "Acesso restrito por IP", value: "ip_restricted", score: 1.5 },
        { label: "Híbrido", value: "hybrid", score: 2 },
      ],
    },
    {
      category: "Gestão de Acessos",
      text: "O software permite CONTROLE DE PERFIS e permissões de usuários?",
      weight: 7,
      type: "SINGLE_CHOICE",
      riskDimension: "IMPACT",
      options: YES_NO(0.5, 3.5),
    },
    {
      category: "Segurança",
      text: "O software registra LOGS DE ACESSO ou auditoria?",
      weight: 7,
      type: "SINGLE_CHOICE",
      riskDimension: "IMPACT",
      options: YES_NO(0.5, 3.5),
    },
    {
      category: "Integrações",
      text: "O software INTEGRA com outros sistemas da empresa?",
      weight: 4,
      type: "SINGLE_CHOICE",
      riskDimension: "PROBABILITY",
      options: YES_NO(2.5, 0.5),
    },
    {
      category: "Integrações",
      text: "Se houver integrações, informe quais sistemas serão integrados",
      weight: 1,
      type: "TEXT",
      riskDimension: "PROBABILITY",
      isRequired: false,
      options: [],
    },
    {
      category: "LGPD",
      text: "O software ARMAZENA ou PROCESSA DADOS PESSOAIS?",
      weight: 10,
      type: "SINGLE_CHOICE",
      riskDimension: "IMPACT",
      options: YES_NO(4, 0),
    },
    {
      category: "LGPD",
      text: "Qual o TIPO DE DADO pessoal é tratado?",
      weight: 8,
      type: "MULTI_CHOICE",
      riskDimension: "IMPACT",
      isRequired: false,
      options: [
        { label: "Dados cadastrais básicos (nome, e-mail)", value: "basic", score: 1.5 },
        { label: "Dados de contato", value: "contact", score: 1 },
        { label: "Dados financeiros", value: "financial", score: 3.5 },
        { label: "Dados de saúde (sensível)", value: "health", score: 5 },
        { label: "Dados biométricos (sensível)", value: "biometric", score: 5 },
        { label: "Dados de menores de idade", value: "minors", score: 5 },
        { label: "Não se aplica", value: "not_applicable", score: 0 },
      ],
    },
    {
      category: "Dados Sensíveis",
      text: "O software armazena DOCUMENTOS ou ARQUIVOS?",
      weight: 5,
      type: "SINGLE_CHOICE",
      riskDimension: "IMPACT",
      options: YES_NO(2, 0),
    },
    {
      category: "Informações Gerais",
      text: "Informações Adicionais",
      weight: 1,
      type: "TEXT",
      riskDimension: "BOTH",
      isRequired: false,
      options: [],
    },
  ];

  // Substituição completa: o seed é a fonte da verdade só até o CRUD
  // administrativo (Etapa 4) existir de fato — depois disso, ajustes de
  // questionário devem ser feitos por lá, não reeditando este arquivo.
  // Seguro apagar em dev: nenhuma Assessment é seedada, então não há
  // AssessmentAnswer referenciando essas perguntas ainda.
  await prisma.question.deleteMany({ where: { tenantId: tenant.id } });

  const questionOptionByLabel = new Map<string, { id: string }>();
  for (const [index, seedQuestion] of seedQuestions.entries()) {
    const category = categoryByName.get(seedQuestion.category)!;
    const existing = await prisma.question.findFirst({
      where: { tenantId: tenant.id, categoryId: category.id, text: seedQuestion.text },
    });
    const question =
      existing ??
      (await prisma.question.create({
        data: {
          tenantId: tenant.id,
          categoryId: category.id,
          text: seedQuestion.text,
          description: seedQuestion.description,
          weight: seedQuestion.weight,
          type: seedQuestion.type,
          riskDimension: seedQuestion.riskDimension,
          isRequired: seedQuestion.isRequired ?? true,
          order: index,
        },
      }));

    for (const [optionIndex, option] of seedQuestion.options.entries()) {
      const questionOption = await prisma.questionOption.upsert({
        where: { id: `${question.id}-${optionIndex}` },
        update: {},
        create: {
          id: `${question.id}-${optionIndex}`,
          questionId: question.id,
          label: option.label,
          value: option.value,
          score: option.score,
          order: optionIndex,
        },
      });
      questionOptionByLabel.set(`${seedQuestion.text}::${option.label}`, questionOption);
    }
  }

  // --- Biblioteca de controles --------------------------------------------------
  for (const framework of CONTROL_FRAMEWORKS) {
    await prisma.controlFramework.upsert({
      where: { code: framework.code },
      update: { name: framework.name },
      create: framework,
    });
  }
  const iso27001 = await prisma.controlFramework.findUniqueOrThrow({
    where: { code: "ISO_27001" },
  });
  const nistCsf = await prisma.controlFramework.findUniqueOrThrow({ where: { code: "NIST_CSF" } });
  const lgpd = await prisma.controlFramework.findUniqueOrThrow({ where: { code: "LGPD" } });

  const controlA9 = await prisma.control.upsert({
    where: { frameworkId_code: { frameworkId: iso27001.id, code: "A.9" } },
    update: {},
    create: {
      frameworkId: iso27001.id,
      code: "A.9",
      title: "Controle de acesso",
      description: "Requisitos de controle de acesso e autenticação, incluindo MFA.",
    },
  });
  const controlPr = await prisma.control.upsert({
    where: { frameworkId_code: { frameworkId: nistCsf.id, code: "PR.AA" } },
    update: {},
    create: {
      frameworkId: nistCsf.id,
      code: "PR.AA",
      title: "Identity Management, Authentication and Access Control",
      description: "Gestão de identidade, autenticação e controle de acesso.",
    },
  });
  const controlLgpdArt46 = await prisma.control.upsert({
    where: { frameworkId_code: { frameworkId: lgpd.id, code: "Art. 46" } },
    update: {},
    create: {
      frameworkId: lgpd.id,
      code: "Art. 46",
      title: "Segurança e sigilo de dados",
      description: "Medidas técnicas e administrativas de proteção de dados pessoais.",
    },
  });

  const mfaQuestion = await prisma.question.findFirstOrThrow({
    where: {
      tenantId: tenant.id,
      text: { contains: "Múltiplo Fator de Autenticação", mode: "insensitive" },
    },
  });
  const lgpdQuestion = await prisma.question.findFirstOrThrow({
    where: {
      tenantId: tenant.id,
      text: { contains: "ARMAZENA ou PROCESSA DADOS PESSOAIS", mode: "insensitive" },
    },
  });
  for (const controlId of [controlA9.id, controlPr.id]) {
    await prisma.questionControl.upsert({
      where: { questionId_controlId: { questionId: mfaQuestion.id, controlId } },
      update: {},
      create: { questionId: mfaQuestion.id, controlId },
    });
  }
  await prisma.questionControl.upsert({
    where: {
      questionId_controlId: { questionId: lgpdQuestion.id, controlId: controlLgpdArt46.id },
    },
    update: {},
    create: { questionId: lgpdQuestion.id, controlId: controlLgpdArt46.id },
  });

  // --- Matriz de risco padrão ----------------------------------------------------
  // Escala 1-5, alinhada ao motor já em produção da empresa (n8n): quanto
  // MAIOR o score, mais SEGURO (mesma convenção do output de exemplo do n8n
  // — "risk_score: 4.1, risk_classification: Homologado"). probabilityScore/
  // impactScore/totalScore em RiskResult seguem essa mesma convenção — são
  // scores de "segurança", não de "risco" cru (esse fica só na QuestionOption,
  // internamente, onde é mais intuitivo o admin configurar "quão arriscada é
  // esta resposta").
  let riskMatrix = await prisma.riskMatrixConfig.findFirst({
    where: { tenantId: tenant.id, name: "Matriz Padrão" },
  });
  if (!riskMatrix) {
    riskMatrix = await prisma.riskMatrixConfig.create({
      data: {
        tenantId: tenant.id,
        name: "Matriz Padrão",
        version: 1,
        isActive: true,
        minApprovalScore: 3.0,
      },
    });
  } else {
    riskMatrix = await prisma.riskMatrixConfig.update({
      where: { id: riskMatrix.id },
      data: { minApprovalScore: 3.0 },
    });
  }

  // Rótulos em termos de probabilidade/impacto DE RISCO — por isso a ordem é
  // invertida em relação ao score de segurança: "Alta" (probabilidade/impacto
  // de risco) cai na faixa BAIXA do score de segurança, e vice-versa.
  const probabilityDefs = [
    { label: "Alta", order: 1, minScore: 0, maxScore: 1.66 },
    { label: "Média", order: 2, minScore: 1.67, maxScore: 3.33 },
    { label: "Baixa", order: 3, minScore: 3.34, maxScore: 5 },
  ];
  const impactDefs = [
    { label: "Alto", order: 1, minScore: 0, maxScore: 1.66 },
    { label: "Médio", order: 2, minScore: 1.67, maxScore: 3.33 },
    { label: "Baixo", order: 3, minScore: 3.34, maxScore: 5 },
  ];
  // Faixas do score TOTAL (0-5) — é isso que o RiskEngine (Etapa 5) usa de
  // fato para decidir a classificação, não a grade abaixo (que é só para o
  // heatmap futuro, Etapa 9).
  const classificationDefs = [
    { label: "Rejeitado", order: 1, color: "#dc2626", minScore: 0, maxScore: 2.99 },
    { label: "Aguardando Ajustes", order: 2, color: "#ca8a04", minScore: 3.0, maxScore: 3.99 },
    { label: "Homologado", order: 3, color: "#16a34a", minScore: 4.0, maxScore: 5.0 },
  ];

  const probabilityLevelByLabel = new Map<string, { id: string }>();
  for (const def of probabilityDefs) {
    const level = await prisma.probabilityLevel.upsert({
      where: { id: `${riskMatrix.id}-prob-${def.order}` },
      update: { minScore: def.minScore, maxScore: def.maxScore },
      create: { id: `${riskMatrix.id}-prob-${def.order}`, riskMatrixConfigId: riskMatrix.id, ...def },
    });
    probabilityLevelByLabel.set(def.label, level);
  }
  const impactLevelByLabel = new Map<string, { id: string }>();
  for (const def of impactDefs) {
    const level = await prisma.impactLevel.upsert({
      where: { id: `${riskMatrix.id}-impact-${def.order}` },
      update: { minScore: def.minScore, maxScore: def.maxScore },
      create: { id: `${riskMatrix.id}-impact-${def.order}`, riskMatrixConfigId: riskMatrix.id, ...def },
    });
    impactLevelByLabel.set(def.label, level);
  }
  const classificationByLabel = new Map<string, { id: string }>();
  for (const def of classificationDefs) {
    const classification = await prisma.riskClassification.upsert({
      where: { id: `${riskMatrix.id}-class-${def.order}` },
      update: { minScore: def.minScore, maxScore: def.maxScore, color: def.color },
      create: {
        id: `${riskMatrix.id}-class-${def.order}`,
        riskMatrixConfigId: riskMatrix.id,
        label: def.label,
        order: def.order,
        color: def.color,
        minScore: def.minScore,
        maxScore: def.maxScore,
      },
    });
    classificationByLabel.set(def.label, classification);
  }

  // Grade 3x3 (probabilidade x impacto) -> classificação. Só alimenta o
  // heatmap (Etapa 9) — a decisão de aprovação vem do totalScore contra os
  // thresholds de RiskClassification acima, não desta grade.
  const matrixGrid: Record<string, Record<string, string>> = {
    Baixa: { Baixo: "Homologado", Médio: "Homologado", Alto: "Aguardando Ajustes" },
    Média: { Baixo: "Homologado", Médio: "Aguardando Ajustes", Alto: "Rejeitado" },
    Alta: { Baixo: "Aguardando Ajustes", Médio: "Rejeitado", Alto: "Rejeitado" },
  };
  for (const [probLabel, impactMap] of Object.entries(matrixGrid)) {
    for (const [impactLabel, classificationLabel] of Object.entries(impactMap)) {
      const probabilityLevel = probabilityLevelByLabel.get(probLabel)!;
      const impactLevel = impactLevelByLabel.get(impactLabel)!;
      const classification = classificationByLabel.get(classificationLabel)!;
      await prisma.riskMatrixCell.upsert({
        where: {
          probabilityLevelId_impactLevelId: {
            probabilityLevelId: probabilityLevel.id,
            impactLevelId: impactLevel.id,
          },
        },
        update: { riskClassificationId: classification.id },
        create: {
          riskMatrixConfigId: riskMatrix.id,
          probabilityLevelId: probabilityLevel.id,
          impactLevelId: impactLevel.id,
          riskClassificationId: classification.id,
        },
      });
    }
  }

  // --- Recomendações automáticas ---------------------------------------------
  const mfaNoOption = questionOptionByLabel.get(
    "O Software utiliza Múltiplo Fator de Autenticação (MFA)?::Não",
  );
  if (mfaNoOption) {
    await prisma.recommendation.upsert({
      where: { id: `${tenant.id}-rec-mfa` },
      update: {},
      create: {
        id: `${tenant.id}-rec-mfa`,
        tenantId: tenant.id,
        text: "Implementar autenticação multifator (MFA) antes da entrada em produção.",
        triggerOptionId: mfaNoOption.id,
      },
    });
  }
  const lgpdYesOption = questionOptionByLabel.get(
    "O software ARMAZENA ou PROCESSA DADOS PESSOAIS?::Sim",
  );
  if (lgpdYesOption) {
    await prisma.recommendation.upsert({
      where: { id: `${tenant.id}-rec-dpia` },
      update: {},
      create: {
        id: `${tenant.id}-rec-dpia`,
        tenantId: tenant.id,
        text: "Executar um Relatório de Impacto à Proteção de Dados (DPIA/RIPD) e envolver o DPO.",
        triggerOptionId: lgpdYesOption.id,
      },
    });
  }

  // --- Fluxo de aprovação padrão -----------------------------------------------
  let workflow = await prisma.workflowDefinition.findFirst({
    where: { tenantId: tenant.id, name: "Fluxo Padrão" },
  });
  if (!workflow) {
    workflow = await prisma.workflowDefinition.create({
      data: { tenantId: tenant.id, name: "Fluxo Padrão", isDefault: true, isActive: true },
    });
  }

  const stepDefs = [
    { order: 1, name: "Gestor da Área", role: "Gestor da Área", slaHours: 48, isOptional: false, requiresLgpd: false },
    { order: 2, name: "Segurança da Informação", role: "Segurança da Informação", slaHours: 72, isOptional: false, requiresLgpd: false },
    { order: 3, name: "DPO", role: "DPO", slaHours: 48, isOptional: false, requiresLgpd: true },
    { order: 4, name: "Jurídico", role: "Jurídico", slaHours: 48, isOptional: true, requiresLgpd: false },
    { order: 5, name: "Aprovação Final", role: "Administrador", slaHours: 24, isOptional: false, requiresLgpd: false },
  ];
  for (const stepDef of stepDefs) {
    const role = roleByName.get(stepDef.role)!;
    await prisma.workflowStep.upsert({
      where: { workflowDefinitionId_order: { workflowDefinitionId: workflow.id, order: stepDef.order } },
      update: {
        name: stepDef.name,
        responsibleRoleId: role.id,
        slaHours: stepDef.slaHours,
        isOptional: stepDef.isOptional,
        requiresLgpd: stepDef.requiresLgpd,
      },
      create: {
        workflowDefinitionId: workflow.id,
        order: stepDef.order,
        name: stepDef.name,
        responsibleRoleId: role.id,
        slaHours: stepDef.slaHours,
        isOptional: stepDef.isOptional,
        requiresLgpd: stepDef.requiresLgpd,
      },
    });
  }

  console.log("Seed concluído:", {
    tenant: tenant.slug,
    areas: AREAS.length,
    permissions: allPermissions.length,
    roles: roleDefs.length,
    users: [adminUser.email, demoUser.email],
    demoPassword: DEMO_PASSWORD,
    categories: QUESTION_CATEGORIES.length,
    questions: seedQuestions.length,
    controlFrameworks: CONTROL_FRAMEWORKS.length,
    riskMatrix: riskMatrix.name,
    workflow: workflow.name,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
