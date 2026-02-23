/**
 * Shared prompt-building and usage-formatting helpers used by
 * both geminiClient (audio/text) and urlContextClient (URL context).
 */

// ── Language instruction map ────────────────────────────────────────

export function getLanguageInstruction(outputLanguage?: string): string {
  switch (outputLanguage) {
    case 'fr':
      return 'Répondez à la tâche ci-dessous en français.';
    case 'ar':
      return 'أجب على المهمة أدناه باللغة العربية الفصحى.';
    case 'tn':
      return 'Répondez à la tâche ci-dessous en tunisien.';
    case 'en':
      return 'Respond to the task below in English.';
    default:
      return '';
  }
}

// ── Customization lines ─────────────────────────────────────────────

export interface CustomizationParams {
  promptStyle?: string;
  outputVerbosity?: string;
  outputFormat?: string;
  includeDetails?: string;
  excludeDetails?: string;
}

/** Build the optional "Prompt style / Verbosity / …" lines. */
export function buildCustomizationLines(params: CustomizationParams): string[] {
  const lines: string[] = [];
  if (params.promptStyle) lines.push(`Prompt style: ${params.promptStyle}`);
  if (params.outputVerbosity) lines.push(`Verbosity: ${params.outputVerbosity}`);
  if (params.outputFormat) lines.push(`Format: ${params.outputFormat}`);
  if (params.includeDetails) lines.push(`Include: ${params.includeDetails}`);
  if (params.excludeDetails) lines.push(`Exclude: ${params.excludeDetails}`);
  return lines;
}

// ── Usage / cost formatting ─────────────────────────────────────────

export interface ModelCost {
  inputCostPer1MTokens: number;
  outputCostPer1MTokens: number;
}

export function formatUsage(
  raw: { inputTokens?: number; outputTokens?: number; totalTokens?: number },
  cost: ModelCost,
) {
  const inputTokens = raw.inputTokens ?? 0;
  const outputTokens = raw.outputTokens ?? 0;
  const totalTokens = raw.totalTokens ?? inputTokens + outputTokens;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd:
      (inputTokens / 1_000_000) * cost.inputCostPer1MTokens +
      (outputTokens / 1_000_000) * cost.outputCostPer1MTokens,
  };
}
