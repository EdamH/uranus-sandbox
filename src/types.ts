export interface InferenceParams {
  modelId: string;
  mimeType: string;
  base64Audio?: string;
  inputText?: string;
  outputLanguage?: string;
  promptStyle?: string;
  outputVerbosity?: string;
  outputFormat?: string;
  includeDetails?: string;
  excludeDetails?: string;
}
export type ModelType = 'text' | 'native-audio';

export interface ModelConfig {
  id: string;
  label: string;
  type: ModelType;
  inputCostPer1MTokens: number;
  outputCostPer1MTokens: number;
}

export interface InferenceUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface InferenceResult {
  modelId: string;
  modelLabel: string;
  modelType: ModelType;
  text: string;
  usage: InferenceUsage;
  latencyMs: number;
  success: boolean;
  error?: string;
}

export interface TelemetryRecord {
  id: string;
  timestamp: string;
  input: 
    | { type: 'audio'; mimeType: string; approximateBytes: number }
    | { type: 'ocr'; mimeType: string; extractedText: string }
    | { type: 'url'; url: string };
  result: InferenceResult;
}
