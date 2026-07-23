"use client";

import { useTranslations } from "next-intl";
import type { LucideIcon } from "lucide-react";
import { Boxes, CheckCircle2, ClipboardList, FileText, UserCircle } from "lucide-react";

import { useRequireAuth } from "@/lib/use-require-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface FaqSection {
  key: string;
  icon: LucideIcon;
  questionKeys: string[];
}

/** Cada seção mapeia pra um bloco `Faq.sections.<key>` em i18n, com `title` +
 * um par `q<n>Question`/`q<n>Answer` por pergunta em `questionKeys`. Conteúdo
 * fixo (não dinâmico) — cobre os principais fluxos do sistema hoje; ganhar
 * uma pergunta nova é só adicionar a chave aqui e o texto em pt-BR/en. */
const FAQ_SECTIONS: FaqSection[] = [
  { key: "assessments", icon: ClipboardList, questionKeys: ["q1", "q2", "q3"] },
  { key: "approvals", icon: CheckCircle2, questionKeys: ["q1", "q2"] },
  { key: "inventory", icon: Boxes, questionKeys: ["q1", "q2", "q3"] },
  { key: "technicalOpinions", icon: FileText, questionKeys: ["q1", "q2", "q3"] },
  { key: "account", icon: UserCircle, questionKeys: ["q1", "q2", "q3"] },
];

export default function FaqPage() {
  const t = useTranslations("Faq");
  const user = useRequireAuth();

  if (!user) return null;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex flex-col gap-4">
        {FAQ_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.key}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="size-4 text-muted-foreground" />
                  {t(`sections.${section.key}.title`)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible>
                  {section.questionKeys.map((questionKey) => (
                    <AccordionItem key={questionKey} value={questionKey}>
                      <AccordionTrigger>
                        {t(`sections.${section.key}.${questionKey}Question`)}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {t(`sections.${section.key}.${questionKey}Answer`)}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
