import 'dotenv/config';

import express from 'express';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { MODELS } from '@/config/models';

import { runUrlContextInference, buildUrlContextPromptPayload } from './services/urlContextClient';
import { runModelInference, buildModelPromptPayload } from '@/services/geminiClient';
import { extractTextFromImage } from './services/ocrClient';

const app = express();

const PORT = Number(process.env.PORT || 3101);
const TELEMETRY_PATH = process.env.TELEMETRY_LOG_PATH || './data/telemetry.jsonl';
const SAVED_AUDIO_PATH = './data/saved-audio';

app.use(express.json({ limit: '30mb' }));

app.use(express.static('public'));

// OCR Describe Endpoint
app.post('/api/ocr-describe', async (req, res) => {
  if (!process.env.GOOGLE_VERTEX_PROJECT && !process.env.GOOGLE_VERTEX_API_KEY) {
    res.status(500).json({
      error:
        'Missing Vertex configuration. Set GOOGLE_VERTEX_PROJECT (and auth) or GOOGLE_VERTEX_API_KEY.',
    });
    return;
  }

  const body = req.body as {
    imageBase64?: string;
    modelId?: string;
    outputLanguage?: string;
    promptStyle?: string;
    outputVerbosity?: string;
    outputFormat?: string;
    includeDetails?: string;
    excludeDetails?: string;
  };

  if (!body.imageBase64) {
    res.status(400).json({ error: 'imageBase64 is required' });
    return;
  }

  const modelId = body.modelId || 'gemini-2.5-pro';
  const outputLanguage = body.outputLanguage || 'en';
  const promptStyle = body.promptStyle || 'concise';
  const outputVerbosity = body.outputVerbosity || 'concise';
  const outputFormat = body.outputFormat || 'paragraph';
  const includeDetails = body.includeDetails || '';
  const excludeDetails = body.excludeDetails || '';

  try {
    // Step 1: OCR
    const extractedText = await extractTextFromImage(body.imageBase64);
    if (!extractedText) {
      res.status(400).json({ error: 'No text found in image.' });
      return;
    }

    // Step 2: Description generation
    const result = await runModelInference({
      modelId,
      mimeType: 'text/plain',
      inputText: extractedText,
      outputLanguage,
      promptStyle,
      outputVerbosity,
      outputFormat,
      includeDetails,
      excludeDetails,
    });

    // Step 3: Telemetry logging (optional, similar to audio)
    await logTelemetry({
      telemetryPath: TELEMETRY_PATH,
      mimeType: 'image',
      result,
      extractedText,
    });

    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'OCR/Inference failed' });
  }
});

import { getTelemetrySnapshot, logTelemetry } from '@/services/telemetry';
import { loadTelemetryFromFile } from '@/services/telemetry';

// const app = express();

// const PORT = Number(process.env.PORT || 3101);
// const TELEMETRY_PATH = process.env.TELEMETRY_LOG_PATH || './data/telemetry.jsonl';
// const SAVED_AUDIO_PATH = './data/saved-audio';

app.use(express.json({ limit: '30mb' }));

app.use(express.static('public'));
// URL Context Summarization Endpoint
app.post('/api/url-describe', async (req, res) => {
  if (!process.env.GOOGLE_VERTEX_PROJECT && !process.env.GOOGLE_VERTEX_API_KEY) {
    res.status(500).json({
      error:
        'Missing Vertex configuration. Set GOOGLE_VERTEX_PROJECT (and auth) or GOOGLE_VERTEX_API_KEY.',
    });
    return;
  }

  const body = req.body as {
    url?: string;
    modelId?: string;
    prompt?: string;
    outputLanguage?: string;
    promptStyle?: string;
    outputVerbosity?: string;
    outputFormat?: string;
    includeDetails?: string;
    excludeDetails?: string;
  };

  if (!body.url) {
    res.status(400).json({ error: 'url is required' });
    return;
  }
  const modelId = body.modelId || 'gemini-2.5-pro';
  try {
    const result = await runUrlContextInference({
      modelId,
      url: body.url,
      prompt: body.prompt,
      outputLanguage: body.outputLanguage,
      promptStyle: body.promptStyle,
      outputVerbosity: body.outputVerbosity,
      outputFormat: body.outputFormat,
      includeDetails: body.includeDetails,
      excludeDetails: body.excludeDetails,
    });

    // Log telemetry for URL context
    await logTelemetry({
      telemetryPath: TELEMETRY_PATH,
      url: body.url,
      result,
    });

    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Inference failed' });
  }
});

app.post('/api/describe-preview', async (req, res) => {
  const body = req.body as {
    mimeType?: string;
    outputLanguage?: string;
    promptStyle?: string;
    outputVerbosity?: string;
    outputFormat?: string;
    includeDetails?: string;
    excludeDetails?: string;
  };

  const mimeType = body.mimeType || 'audio/webm';
  const outputLanguage = body.outputLanguage || 'en';
  const promptStyle = body.promptStyle || 'concise';
  const outputVerbosity = body.outputVerbosity || 'concise';
  const outputFormat = body.outputFormat || 'paragraph';
  const includeDetails = body.includeDetails || '';
  const excludeDetails = body.excludeDetails || '';

  const { systemPrompt, userMessage } = buildModelPromptPayload({
    modelId: 'prompt-preview',
    mimeType,
    base64Audio: 'preview-only',
    outputLanguage,
    promptStyle,
    outputVerbosity,
    outputFormat,
    includeDetails,
    excludeDetails,
  });

  res.json({
    mode: 'audio',
    preview: {
      systemPrompt,
      userMessage,
      messageContent: [
        { type: 'text', text: userMessage },
        { type: 'file', mediaType: mimeType, data: '[binary audio omitted in preview]' },
      ],
    },
  });
});

app.post('/api/url-describe-preview', async (req, res) => {
  const body = req.body as {
    url?: string;
    prompt?: string;
    outputLanguage?: string;
    promptStyle?: string;
    outputVerbosity?: string;
    outputFormat?: string;
    includeDetails?: string;
    excludeDetails?: string;
  };

  if (!body.url) {
    res.status(400).json({ error: 'url is required' });
    return;
  }

  const { systemPrompt, finalPrompt } = buildUrlContextPromptPayload({
    url: body.url,
    prompt: body.prompt,
    outputLanguage: body.outputLanguage,
    promptStyle: body.promptStyle,
    outputVerbosity: body.outputVerbosity,
    outputFormat: body.outputFormat,
    includeDetails: body.includeDetails,
    excludeDetails: body.excludeDetails,
  });

  res.json({
    mode: 'url',
    preview: {
      systemPrompt,
      finalPrompt,
    },
  });
});

app.post('/api/ocr-describe-preview', async (req, res) => {
  const body = req.body as {
    imageBase64?: string;
    outputLanguage?: string;
    promptStyle?: string;
    outputVerbosity?: string;
    outputFormat?: string;
    includeDetails?: string;
    excludeDetails?: string;
  };

  if (!body.imageBase64) {
    res.status(400).json({ error: 'imageBase64 is required' });
    return;
  }

  try {
    const extractedText = await extractTextFromImage(body.imageBase64);
    if (!extractedText) {
      res.status(400).json({ error: 'No text found in image.' });
      return;
    }

    const outputLanguage = body.outputLanguage || 'en';
    const promptStyle = body.promptStyle || 'concise';
    const outputVerbosity = body.outputVerbosity || 'concise';
    const outputFormat = body.outputFormat || 'paragraph';
    const includeDetails = body.includeDetails || '';
    const excludeDetails = body.excludeDetails || '';

    const { systemPrompt, userMessage } = buildModelPromptPayload({
      modelId: 'prompt-preview',
      mimeType: 'text/plain',
      inputText: extractedText,
      outputLanguage,
      promptStyle,
      outputVerbosity,
      outputFormat,
      includeDetails,
      excludeDetails,
    });

    res.json({
      mode: 'ocr',
      preview: {
        systemPrompt,
        userMessage: `${userMessage}\n${extractedText}`,
        extractedText,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'OCR preview failed' });
  }
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get('/api/models', (_req, res) => {
  res.json({ models: MODELS });
});

app.get('/api/telemetry', (req, res) => {
  const { modelName, modelType } = req.query;

  // Always get fresh telemetry data
  let telemetryData = getTelemetrySnapshot();

  if (modelName) {
    telemetryData.byModel = telemetryData.byModel.filter((entry) => entry.modelLabel === modelName);
  }

  if (modelType) {
    telemetryData.byModel = telemetryData.byModel.filter((entry) => entry.modelType === modelType);
  }

  res.json(telemetryData);
});

app.post('/api/describe', async (req, res) => {
  if (!process.env.GOOGLE_VERTEX_PROJECT && !process.env.GOOGLE_VERTEX_API_KEY) {
    res.status(500).json({
      error:
        'Missing Vertex configuration. Set GOOGLE_VERTEX_PROJECT (and auth) or GOOGLE_VERTEX_API_KEY.',
    });
    return;
  }

  const body = req.body as {
    audioBase64?: string;
    mimeType?: string;
    modelId?: string;
    modelIds?: string[];
    runAll?: boolean;
    outputLanguage?: string;
    promptStyle?: string;
    outputVerbosity?: string;
    outputFormat?: string;
    includeDetails?: string;
    excludeDetails?: string;
  };

  if (!body.audioBase64 || !body.mimeType) {
    res.status(400).json({ error: 'audioBase64 and mimeType are required' });
    return;
  }

  const requestedModelIds = body.runAll
    ? MODELS.map((model) => model.id)
    : body.modelIds && body.modelIds.length > 0
      ? body.modelIds
      : body.modelId
        ? [body.modelId]
        : [];

  if (requestedModelIds.length === 0) {
    res.status(400).json({ error: 'Provide modelId, modelIds, or runAll=true' });
    return;
  }


  const outputLanguage = body.outputLanguage || 'en';
  const promptStyle = body.promptStyle || 'concise';
  const outputVerbosity = body.outputVerbosity || 'concise';
  const outputFormat = body.outputFormat || 'paragraph';
  const includeDetails = body.includeDetails || '';
  const excludeDetails = body.excludeDetails || '';

  const results = await Promise.all(
    requestedModelIds.map((modelId) =>
      runModelInference({
        modelId,
        mimeType: body.mimeType!,
        base64Audio: body.audioBase64!,
        outputLanguage,
        promptStyle,
        outputVerbosity,
        outputFormat,
        includeDetails,
        excludeDetails,
      }),
    ),
  );

  await Promise.all(
    results.map((result) =>
      logTelemetry({
        telemetryPath: TELEMETRY_PATH,
        base64Audio: body.audioBase64!,
        mimeType: body.mimeType!,
        result,
      }),
    ),
  );

  res.json({
    count: results.length,
    results,
  });
});

// List saved audio files
app.get('/api/saved-audio', async (_req, res) => {
  try {
    await mkdir(SAVED_AUDIO_PATH, { recursive: true });
    const files = await readdir(SAVED_AUDIO_PATH);
    const audioFiles = files.filter(f => f.endsWith('.json'));
    const savedAudio = await Promise.all(
      audioFiles.map(async (filename) => {
        const content = await readFile(join(SAVED_AUDIO_PATH, filename), 'utf8');
        const data = JSON.parse(content);
        return {
          id: filename.replace('.json', ''),
          name: data.name,
          mimeType: data.mimeType,
          createdAt: data.createdAt,
        };
      })
    );
    res.json({ savedAudio: savedAudio.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list saved audio' });
  }
});

// Save audio file
app.post('/api/saved-audio', async (req, res) => {
  try {
    const { name, audioBase64, mimeType } = req.body;
    if (!name || !audioBase64 || !mimeType) {
      res.status(400).json({ error: 'name, audioBase64, and mimeType are required' });
      return;
    }
    await mkdir(SAVED_AUDIO_PATH, { recursive: true });
    const id = `audio-${Date.now()}`;
    const data = {
      name,
      audioBase64,
      mimeType,
      createdAt: new Date().toISOString(),
    };
    await writeFile(join(SAVED_AUDIO_PATH, `${id}.json`), JSON.stringify(data), 'utf8');
    res.json({ id, name, createdAt: data.createdAt });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save audio' });
  }
});

// Load saved audio file
app.get('/api/saved-audio/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const content = await readFile(join(SAVED_AUDIO_PATH, `${id}.json`), 'utf8');
    const data = JSON.parse(content);
    res.json(data);
  } catch (error) {
    res.status(404).json({ error: 'Audio not found' });
  }
});

app.listen(PORT, async () => {
  console.log(`[uranus] listening on http://localhost:${PORT}`);
  await loadTelemetryFromFile(TELEMETRY_PATH);
  await mkdir(SAVED_AUDIO_PATH, { recursive: true });
});