import type { ModelConfig } from '@/types';

export const MODELS: ModelConfig[] = [
  {
    id: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash Preview (text model)',
    type: 'text',
    inputCostPer1MTokens: 1,
    outputCostPer1MTokens: 3,
  },
  {
    id: 'gemini-3-pro-preview',
    label: 'Gemini 3 Pro Preview (text model)',
    type: 'text',
    inputCostPer1MTokens: 2,
    outputCostPer1MTokens: 12,
  },
  {
    id: 'gemini-3-flash-native-audio-preview',
    label: 'Gemini 3 Flash Native Audio Preview',
    type: 'native-audio',
    inputCostPer1MTokens: 1,
    outputCostPer1MTokens: 3,
  },
  {
    id: 'gemini-3-pro-native-audio-preview',
    label: 'Gemini 3 Pro Native Audio Preview',
    type: 'native-audio',
    inputCostPer1MTokens: 2,
    outputCostPer1MTokens: 12,
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    type: 'text',
    inputCostPer1MTokens: 1.25,
    outputCostPer1MTokens: 10,
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    type: 'text',
    inputCostPer1MTokens: 1,
    outputCostPer1MTokens: 2.5,
  }
];

export const MODEL_MAP = new Map(MODELS.map((model) => [model.id, model]));
