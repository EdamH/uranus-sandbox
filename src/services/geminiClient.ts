import { vertex } from '@ai-sdk/google-vertex';
import { generateText } from 'ai';

import { MODEL_MAP } from '@/config/models';
import type { InferenceResult } from '@/types';
import { getLanguageInstruction, buildCustomizationLines, formatUsage } from './promptBuilder';

const PRODUCT_DESCRIPTION_PROMPT = `You are a copywriter specializing in e-commerce. Your goal is to convert audio descriptions into high-converting, professional storefront text.

Task:
1) Listen to the provided product audio description (Tunisian Arabic may be used).
2) Produce a clean, structured product description text STRICTLY in the language provided above.

Output format:
- Product Name: ...
- Short Description: ...
- Key Features:
  - ...
  - ...

Rules:
- Do not mention that this came from audio.
- Keep it concise, professional, and ready to paste into a storefront dashboard.
- If something is unclear, infer the most likely meaning and note assumptions briefly at the end as "Assumptions: ...".
- You are to STRICTLY follow the output format. No deviations or additional commentary, other than assumptions if needed.`;

const TUNISIAN_SPECIFICATION = `
### TUNISIAN LANGUAGE RULES (STRICT)
- Language: Tunisian Derja (Tounsi).
- Use authentic local vocabulary: (e.g., "Thamma" instead of "Yujad", "Behi" instead of "Jayyid").
- Script: Arabic script only.
- Mixing: Keep common French e-commerce terms in Arabic script (e.g., "Chemise" as "شميز") as is natural in Tunisian shopping.
- Tone: Professional Boutique (not street slang, but not formal MSA).
`;

import type { InferenceParams } from '@/types';

export function buildModelPromptPayload(params: InferenceParams): {
  systemPrompt: string;
  userMessage: string;
} {
  let systemPrompt: string;
  if (params.outputLanguage === 'tn') {
    systemPrompt = `${PRODUCT_DESCRIPTION_PROMPT}\n\n${TUNISIAN_SPECIFICATION}`;
  } else {
    const langInstruction = getLanguageInstruction(params.outputLanguage);
    systemPrompt = langInstruction
      ? `${langInstruction}\n\n${PRODUCT_DESCRIPTION_PROMPT}`
      : PRODUCT_DESCRIPTION_PROMPT;
  }

  const customLines = buildCustomizationLines(params);
  const userMessage =
    customLines.length > 0
      ? customLines.join('\n')
      : 'Please process this input following the system rules.';

  return { systemPrompt, userMessage };
}

export async function runModelInference(params: InferenceParams): Promise<InferenceResult> {
  const model = MODEL_MAP.get(params.modelId);

  console.log('Running inference with params:', params)

  if (!model) {
    return {
      modelId: params.modelId,
      modelLabel: params.modelId,
      modelType: 'text',
      text: '',
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
      },
      latencyMs: 0,
      success: false,
      error: 'Unknown model id',
    };
  }

  if (!params.base64Audio && !params.inputText) {
    return {
      modelId: params.modelId,
      modelLabel: model.label,
      modelType: model.type,
      text: '',
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
      },
      latencyMs: 0,
      success: false,
      error: 'No input provided. Provide either base64Audio or inputText.',
    };
  }

  const startedAt = Date.now();


  try {
    const { systemPrompt, userMessage: baseUserMessage } = buildModelPromptPayload(params);
    let userMessage = baseUserMessage;

    let content;
    if (params.inputText) {
      // OCR flow: send text only
      userMessage += '\n' + params.inputText;
      content = [{ type: 'text' as const, text: userMessage }];
    } else if (params.base64Audio) {
      // Audio flow: send audio file
      content = [
        { type: 'text' as const, text: userMessage },
        {
          type: 'file' as const,
          data: params.base64Audio,
          mediaType: params.mimeType,
        },
      ];
    }

    const result = await generateText({
      model: vertex(model.id),
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: content!,
        },
      ],
      temperature: 0.2,
      providerOptions: {
        google: {
          safetySettings: [
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          ],
        },
      },
    });

    console.log(`[inference] Model ${model.label} returned result:`, result);

    const text = result.text.trim();
    const usage = formatUsage(result.usage, model);

    return {
      modelId: model.id,
      modelLabel: model.label,
      modelType: model.type,
      text,
      usage,
      latencyMs: Date.now() - startedAt,
      success: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Inference failed';
    return {
      modelId: model.id,
      modelLabel: model.label,
      modelType: model.type,
      text: '',
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
      },
      latencyMs: Date.now() - startedAt,
      success: false,
      error: message,
    };
  }
}
