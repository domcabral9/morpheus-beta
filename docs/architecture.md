# Arquitetura

Diagramas de referência do schema de dados e da topologia de deploy em produção. Complementam o
[`docs/DEVELOPMENT.md`](./DEVELOPMENT.md) (que documenta as decisões etapa a etapa) - aqui o foco é
a visão estrutural.

## Modelo de dados (ER)

36 modelos no total ([`packages/database/prisma/schema.prisma`](../packages/database/prisma/schema.prisma))
- agrupados por domínio abaixo, não num diagrama só, porque um ER de 36 entidades numa imagem só
vira ilegível. Cada diagrama mostra os campos que importam para entender a relação (chaves e um ou
dois campos identificadores), não o schema completo - consulte o `.prisma` para a lista exata de
colunas/constraints.

### Tenancy e RBAC

```mermaid
erDiagram
    TENANT ||--o{ AREA : tem
    TENANT ||--o{ ROLE : tem
    TENANT ||--o{ USER : tem
    ROLE ||--o{ ROLE_PERMISSION : concede
    PERMISSION ||--o{ ROLE_PERMISSION : "concedida em"
    USER ||--o{ USER_ROLE : possui
    ROLE ||--o{ USER_ROLE : "atribuído a"
    USER ||--o{ REFRESH_TOKEN : gera

    TENANT {
        string id PK
        string slug UK
        string opinionNumberPrefix
    }
    AREA {
        string id PK
        string tenantId FK
        string name
    }
    PERMISSION {
        string id PK
        string key UK "catálogo global, não tenant-scoped"
    }
    ROLE {
        string id PK
        string tenantId FK
        string name
        bool isSystem
    }
    USER {
        string id PK
        string tenantId FK
        string email
        string passwordHash "nullable, SSO-only não tem"
        string ssoSubject "nullable"
    }
    REFRESH_TOKEN {
        string id PK
        string userId FK
        string tokenHash "SHA-256, nunca o token cru"
        string ipAddress "AES-256-GCM (Etapa 14)"
        string familyId "rotação + detecção de reuso"
    }
```

### Questionário e biblioteca de controles

```mermaid
erDiagram
    QUESTION_CATEGORY ||--o{ QUESTION : agrupa
    QUESTION ||--o{ QUESTION_OPTION : tem
    QUESTION ||--o{ QUESTION_CONTROL : avalia
    CONTROL_FRAMEWORK ||--o{ CONTROL : contém
    CONTROL ||--o{ QUESTION_CONTROL : "vinculado a"

    QUESTION_CATEGORY {
        string id PK
        string tenantId FK
        string name
        int order
    }
    QUESTION {
        string id PK
        string categoryId FK
        string type "TEXT|SCALE|SINGLE_CHOICE|MULTI_CHOICE"
        string riskDimension "PROBABILITY|IMPACT|BOTH"
        float weight
        bool isRequired
    }
    QUESTION_OPTION {
        string id PK
        string questionId FK
        float score "0=seguro, 5=arriscado"
        bool triggersLgpdReview
    }
    CONTROL_FRAMEWORK {
        string id PK
        string code UK "ISO_27001, NIST_CSF, CIS_V8..."
        string name
    }
    CONTROL {
        string id PK
        string frameworkId FK
        string code
        string title
    }
    QUESTION_CONTROL {
        string questionId PK,FK
        string controlId PK,FK
    }
```

### Motor de risco (matriz configurável)

```mermaid
erDiagram
    RISK_MATRIX_CONFIG ||--o{ PROBABILITY_LEVEL : define
    RISK_MATRIX_CONFIG ||--o{ IMPACT_LEVEL : define
    RISK_MATRIX_CONFIG ||--o{ RISK_CLASSIFICATION : define
    PROBABILITY_LEVEL ||--o{ RISK_MATRIX_CELL : cruza
    IMPACT_LEVEL ||--o{ RISK_MATRIX_CELL : cruza
    RISK_CLASSIFICATION ||--o{ RISK_MATRIX_CELL : resulta
    QUESTION_OPTION ||--o{ RECOMMENDATION : dispara

    RISK_MATRIX_CONFIG {
        string id PK
        string tenantId FK
        int version
        bool isActive
        float minApprovalScore
    }
    PROBABILITY_LEVEL {
        string id PK
        string riskMatrixConfigId FK
        string label
        float minScore
        float maxScore
    }
    IMPACT_LEVEL {
        string id PK
        string riskMatrixConfigId FK
        string label
        float minScore
        float maxScore
    }
    RISK_CLASSIFICATION {
        string id PK
        string riskMatrixConfigId FK
        string label "Rejeitado|Aguardando Ajustes|Homologado"
        float minScore
        float maxScore
    }
    RISK_MATRIX_CELL {
        string probabilityLevelId PK,FK
        string impactLevelId PK,FK
        string riskClassificationId FK
        string riskMatrixConfigId FK
    }
    RECOMMENDATION {
        string id PK
        string tenantId FK
        string triggerOptionId FK
        string text
    }
```

### Avaliação e workflow de aprovação

```mermaid
erDiagram
    ASSESSMENT ||--o{ ASSESSMENT_ANSWER : recebe
    ASSESSMENT_ANSWER ||--o{ ASSESSMENT_ANSWER_OPTION : seleciona
    ASSESSMENT ||--o{ ASSESSMENT_VERSION : versiona
    ASSESSMENT_VERSION ||--o| RISK_RESULT : calcula
    ASSESSMENT_VERSION ||--o{ ASSESSMENT_RECOMMENDATION : sugere
    ASSESSMENT_VERSION ||--o| TECHNICAL_OPINION : gera
    ASSESSMENT ||--o| ASSESSMENT_WORKFLOW_INSTANCE : segue
    WORKFLOW_DEFINITION ||--o{ WORKFLOW_STEP : tem
    ASSESSMENT_WORKFLOW_INSTANCE ||--o{ WORKFLOW_STEP_EXECUTION : executa
    WORKFLOW_STEP ||--o{ WORKFLOW_STEP_EXECUTION : instancia

    ASSESSMENT {
        string id PK
        string tenantId FK
        string requesterId FK
        string areaId FK
        string criticality "LOW|MEDIUM|HIGH|CRITICAL"
        string status
        string installerFileHash "nullable"
    }
    ASSESSMENT_VERSION {
        string id PK
        string assessmentId FK
        string versionLabel
        json snapshotJson "imutável"
    }
    RISK_RESULT {
        string id PK
        string assessmentVersionId FK,UK
        float totalScore "convenção: maior = mais seguro"
        float probabilityScore
        float impactScore
    }
    WORKFLOW_DEFINITION {
        string id PK
        string tenantId FK
        bool isDefault
        bool isActive
    }
    WORKFLOW_STEP {
        string id PK
        string workflowDefinitionId FK
        int order
        string responsibleRoleId FK
        bool isOptional
        bool requiresLgpd
    }
    ASSESSMENT_WORKFLOW_INSTANCE {
        string id PK
        string assessmentId FK,UK
        string status
        int currentStepOrder
    }
    WORKFLOW_STEP_EXECUTION {
        string id PK
        string assessmentWorkflowInstanceId FK
        string workflowStepId FK
        string status
        string decidedById FK "nullable"
    }
    TECHNICAL_OPINION {
        string id PK
        string assessmentVersionId FK,UK
        string number UK
        string hash
        string classificationLabel
    }
```

### Pós-aprovação, documentos e auditoria

```mermaid
erDiagram
    ASSESSMENT ||--o| SOFTWARE_INVENTORY_ITEM : "vira, se aprovada"
    ASSESSMENT ||--o{ ATTACHMENT : anexa
    SOFTWARE_INVENTORY_ITEM ||--o{ ATTACHMENT : anexa
    ASSESSMENT ||--o{ COMMENT : recebe
    USER ||--o{ NOTIFICATION : recebe

    SOFTWARE_INVENTORY_ITEM {
        string id PK
        string tenantId FK
        string assessmentId FK "nullable"
        string status "ACTIVE|PENDING_REVIEW|..."
        datetime nextReviewDate
    }
    ATTACHMENT {
        string id PK
        string assessmentId FK "nullable, exclusivo com inventoryItemId"
        string inventoryItemId FK "nullable"
        string category
        int version "nunca sobrescreve, sempre incrementa"
    }
    COMMENT {
        string id PK
        string assessmentId FK
        string authorId FK
        string body
    }
    AUDIT_LOG {
        string id PK
        string tenantId FK "nullable, SetNull"
        string userId FK "nullable, SetNull"
        string action
        string entityType
        string entityId
    }
    NOTIFICATION {
        string id PK
        string userId FK
        string type
        bool isRead
    }
```

## Topologia de deploy (produção, AWS)

Ver [`infra/terraform/`](../infra/terraform/) para o código - este diagrama é a leitura visual da
mesma infraestrutura descrita no README daquela pasta.

```mermaid
flowchart TB
    subgraph Internet
        Client[Usuário / IdP SAML]
    end

    subgraph "VPC - subnets públicas"
        ALB[Application Load Balancer]
    end

    subgraph "VPC - subnets privadas"
        subgraph "ECS Fargate"
            API1[Task: api]
            API2[Task: api]
            WEB1[Task: web]
            WEB2[Task: web]
            MIGRATE["Task avulsa: migrate\n(disparada no deploy, não é serviço)"]
        end
        EFS[(EFS\nPDFs de parecer técnico)]
        RDS[(RDS Postgres)]
        CloudMap{{"Cloud Map\napi.morpheus.local"}}
    end

    subgraph "Fora da VPC"
        ECR[[ECR\nimagens api/web]]
        Secrets[[Secrets Manager\nDB, JWT, ENCRYPTION_KEY]]
        CW[[CloudWatch Logs]]
    end

    Client -->|HTTP host-based routing| ALB
    ALB -->|host: web_domain_name| WEB1
    ALB -->|host: web_domain_name| WEB2
    ALB -->|host: api_domain_name| API1
    ALB -->|host: api_domain_name| API2

    WEB1 -.->|chamada interna, via Cloud Map| CloudMap
    WEB2 -.->|chamada interna, via Cloud Map| CloudMap
    CloudMap --> API1
    CloudMap --> API2

    API1 --> RDS
    API2 --> RDS
    MIGRATE --> RDS

    API1 --> EFS
    API2 --> EFS

    ECR -.->|pull na inicialização| API1
    ECR -.->|pull na inicialização| WEB1
    Secrets -.->|injetado via task definition| API1
    Secrets -.->|injetado via task definition| MIGRATE
    API1 -.-> CW
    WEB1 -.-> CW
    MIGRATE -.-> CW
```
