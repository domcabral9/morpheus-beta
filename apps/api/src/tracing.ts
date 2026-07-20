import { NodeSDK } from "@opentelemetry/sdk-node";
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

// Precisa rodar (e terminar de instrumentar os módulos) antes de qualquer
// outro require deste processo — por isso main.ts importa este arquivo como
// a primeiríssima linha, antes até de "reflect-metadata". Sem OTEL_EXPORTER_
// OTLP_ENDPOINT configurado, os spans vão para o console (mesmo espírito do
// SmtpEmailAdapter na Etapa 10: funciona sem infraestrutura extra em dev/CI,
// nunca derruba o processo por falta de um collector rodando).
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "morpheus-api",
  }),
  traceExporter: otlpEndpoint
    ? new OTLPTraceExporter({ url: otlpEndpoint })
    : new ConsoleSpanExporter(),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Ruído alto, pouco valor num monorepo pequeno — desliga só essas duas.
      "@opentelemetry/instrumentation-fs": { enabled: false },
      "@opentelemetry/instrumentation-express": { enabled: false },
    }),
  ],
});

sdk.start();

process.on("SIGTERM", () => {
  void sdk.shutdown();
});
