import { vertex } from '@ai-sdk/google-vertex';
import { generateText } from 'ai';
import { MODEL_MAP } from '@/config/models';
import { getLanguageInstruction, buildCustomizationLines, formatUsage } from './promptBuilder';

export function buildUrlContextPromptPayload({
  url,
  prompt = '',
  outputLanguage,
  promptStyle,
  outputVerbosity,
  outputFormat,
  includeDetails,
  excludeDetails,
}: {
  url: string;
  prompt?: string;
  outputLanguage?: string;
  promptStyle?: string;
  outputVerbosity?: string;
  outputFormat?: string;
  includeDetails?: string;
  excludeDetails?: string;
}) {
  const personaMessage = 'You are Uranus, an AI assistant specialized in generating engaging storefront descriptions from product URLs found in the wild. You are friendly, helpful, concise, and adapt your tone to the user’s needs. Your goal is to create clear, accurate, and appealing product descriptions suitable for online stores.';
  const langInstruction = getLanguageInstruction(outputLanguage);
  const systemPrompt = langInstruction
    ? `${personaMessage}\n${langInstruction}`
    : personaMessage;

  const customLines = buildCustomizationLines({
    promptStyle,
    outputVerbosity,
    outputFormat,
    includeDetails,
    excludeDetails,
  });

  let finalPrompt = prompt || `Generate a storefront description for the product at ${url}`;
  if (customLines.length > 0) {
    finalPrompt += '\n' + customLines.join('\n');
  }

  return { systemPrompt, finalPrompt };
}

export async function runUrlContextInference({
  modelId,
  url,
  prompt = '',
  outputLanguage,
  promptStyle,
  outputVerbosity,
  outputFormat,
  includeDetails,
  excludeDetails,
}: {
  modelId: string,
  url: string,
  prompt?: string,
  outputLanguage?: string,
  promptStyle?: string,
  outputVerbosity?: string,
  outputFormat?: string,
  includeDetails?: string,
  excludeDetails?: string,
}) {
  const startedAt = Date.now();
  const model = MODEL_MAP.get(modelId);
  if (!model) throw new Error('Unknown model id');
  console.log('Running URL context inference with params:', {
    modelId,
    url,
    prompt,
    outputLanguage,
    promptStyle,
    outputVerbosity,
    outputFormat,
    includeDetails,
    excludeDetails,
  });

  const { systemPrompt, finalPrompt } = buildUrlContextPromptPayload({
    url,
    prompt,
    outputLanguage,
    promptStyle,
    outputVerbosity,
    outputFormat,
    includeDetails,
    excludeDetails,
  });
  const result = await generateText({
    model: vertex(model.id),
    tools: { url_context: vertex.tools.urlContext({}) },
    system: systemPrompt,
    prompt: finalPrompt,
  });

//   console.log('Inference result:', result);

  return {
    modelId: model.id,
    modelLabel: model.label,
    modelType: model.type,
    text: result.text.trim(),
    usage: formatUsage(result.usage, model),
    latencyMs: Date.now() - startedAt,
    success: true,
  };
}
