"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import type { RiskMatrixConfigDetail } from "@/lib/risk-matrix-admin-types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE_VALUE = "__none__";

/** Cor de texto legível (preto/branco) sobre uma cor de fundo hex qualquer -
 * mesma heurística de luminosidade relativa usada em badges de status. */
function readableTextColor(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "inherit";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#000000" : "#ffffff";
}

export function HeatmapEditor({
  config,
  onChanged,
}: {
  config: RiskMatrixConfigDetail;
  onChanged: () => void;
}) {
  const t = useTranslations("AdminRiskMatrix");
  const api = useApi();
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);

  const { probabilityLevels, impactLevels, riskClassifications, matrixCells } = config;

  async function handleCellChange(probabilityLevelId: string, impactLevelId: string, value: string) {
    const key = `${probabilityLevelId}:${impactLevelId}`;
    const existingCell = matrixCells.find(
      (cell) => cell.probabilityLevelId === probabilityLevelId && cell.impactLevelId === impactLevelId,
    );

    setPendingKey(key);
    try {
      if (value === NONE_VALUE) {
        if (existingCell) {
          await api.delete(`/risk-matrix/admin/cells/${existingCell.id}`);
        }
      } else {
        await api.post(`/risk-matrix/admin/configs/${config.id}/cells`, {
          probabilityLevelId,
          impactLevelId,
          riskClassificationId: value,
        });
      }
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("heatmap.saveError"));
    } finally {
      setPendingKey(null);
    }
  }

  if (probabilityLevels.length === 0 || impactLevels.length === 0 || riskClassifications.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("heatmap.needsLevelsAndClassifications")}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-32 p-2 text-left text-xs font-medium text-muted-foreground">
              {t("heatmap.probabilityAxis")} \ {t("heatmap.impactAxis")}
            </th>
            {impactLevels.map((impactLevel) => (
              <th key={impactLevel.id} className="p-2 text-center text-xs font-medium text-muted-foreground">
                {impactLevel.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {probabilityLevels.map((probabilityLevel) => (
            <tr key={probabilityLevel.id}>
              <th className="p-2 text-left text-xs font-medium text-muted-foreground">
                {probabilityLevel.label}
              </th>
              {impactLevels.map((impactLevel) => {
                const key = `${probabilityLevel.id}:${impactLevel.id}`;
                const cell = matrixCells.find(
                  (candidate) =>
                    candidate.probabilityLevelId === probabilityLevel.id &&
                    candidate.impactLevelId === impactLevel.id,
                );
                const classification = cell
                  ? riskClassifications.find((c) => c.id === cell.riskClassificationId)
                  : undefined;

                return (
                  <td key={key} className="p-1">
                    <Select
                      value={classification?.id ?? NONE_VALUE}
                      disabled={pendingKey === key}
                      onValueChange={(value) => handleCellChange(probabilityLevel.id, impactLevel.id, value)}
                    >
                      <SelectTrigger
                        className="w-36 border-0"
                        style={
                          classification
                            ? {
                                backgroundColor: classification.color,
                                color: readableTextColor(classification.color),
                              }
                            : undefined
                        }
                      >
                        <SelectValue placeholder={t("heatmap.emptyCell")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>{t("heatmap.emptyCell")}</SelectItem>
                        {riskClassifications.map((riskClassification) => (
                          <SelectItem key={riskClassification.id} value={riskClassification.id}>
                            {riskClassification.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
