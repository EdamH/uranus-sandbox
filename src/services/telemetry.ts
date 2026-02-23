import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { v4 as uuidv4 } from 'uuid';

import type { InferenceResult, TelemetryRecord } from '@/types';

const memoryRecords: TelemetryRecord[] = [];

async function loadTelemetryFromFile(telemetryPath: string) {
  try {
    const data = await readFile(telemetryPath, 'utf8');
    const lines = data.split('\n').filter(Boolean);
    lines.forEach((line) => {
      const record = JSON.parse(line);
      memoryRecords.push(record);
    });
    console.log(`[telemetry] Loaded ${memoryRecords.length} records from file.`);
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      console.log('[telemetry] No existing telemetry file found.');
    } else {
      console.error('[telemetry] Failed to load telemetry data:', error);
    }
  }
}

export { memoryRecords, loadTelemetryFromFile };

function toApproximateBytes(base64Audio: string): number {
  return Math.floor((base64Audio.length * 3) / 4);
}

export async function logTelemetry(params: {
  telemetryPath: string;
  base64Audio?: string;
  mimeType?: string;
  result: InferenceResult;
  extractedText?: string;
  url?: string;
}): Promise<TelemetryRecord> {
  let input: TelemetryRecord['input'];

  if (params.url) {
    input = { type: 'url', url: params.url };
  } else if (params.extractedText) {
    input = { type: 'ocr', mimeType: params.mimeType || 'image', extractedText: params.extractedText };
  } else {
    input = {
      type: 'audio',
      mimeType: params.mimeType || 'audio/webm',
      approximateBytes: params.base64Audio ? toApproximateBytes(params.base64Audio) : 0,
    };
  }

  const record: TelemetryRecord = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    input,
    result: params.result,
  };

  memoryRecords.push(record);

  await mkdir(dirname(params.telemetryPath), { recursive: true });
  await appendFile(params.telemetryPath, `${JSON.stringify(record)}\n`, 'utf8');

  return record;
}

export function getTelemetrySnapshot() {
  const totalRequests = memoryRecords.length;
  const successfulRequests = memoryRecords.filter((item) => item.result.success).length;
  const failedRequests = totalRequests - successfulRequests;

  const totals = memoryRecords.reduce(
    (acc, item) => {
      acc.inputTokens += item.result.usage.inputTokens;
      acc.outputTokens += item.result.usage.outputTokens;
      acc.totalTokens += item.result.usage.totalTokens;
      acc.estimatedCostUsd += item.result.usage.estimatedCostUsd;
      return acc;
    },
    {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
    },
  );

  return {
    totalRequests,
    successfulRequests,
    failedRequests,
    totals,
    byModel: aggregateByModel(),
    byInputType: aggregateByInputType(),
    recent: memoryRecords.slice(-20).reverse(),
  };
}

function aggregateByModel() {
  const map = new Map<
    string,
    {
      modelLabel: string;
      modelType: string;
      count: number;
      successCount: number;
      totalTokens: number;
      estimatedCostUsd: number;
      averageLatencyMs: number;
    }
  >();

  for (const item of memoryRecords) {
    const key = item.result.modelId;
    const existing = map.get(key) ?? {
      modelLabel: item.result.modelLabel,
      modelType: item.result.modelType,
      count: 0,
      successCount: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      averageLatencyMs: 0,
    };

    existing.count += 1;
    if (item.result.success) {
      existing.successCount += 1;
    }
    existing.totalTokens += item.result.usage.totalTokens;
    existing.estimatedCostUsd += item.result.usage.estimatedCostUsd;
    existing.averageLatencyMs += item.result.latencyMs;

    map.set(key, existing);
  }

  return Array.from(map.entries()).map(([modelId, data]) => ({
    modelId,
    modelLabel: data.modelLabel,
    modelType: data.modelType,
    count: data.count,
    successCount: data.successCount,
    totalTokens: data.totalTokens,
    estimatedCostUsd: data.estimatedCostUsd,
    averageLatencyMs: data.count > 0 ? Math.round(data.averageLatencyMs / data.count) : 0,
  }));
}

function aggregateByInputType() {
  const map = new Map<
    string,
    {
      count: number;
      successCount: number;
      totalTokens: number;
      estimatedCostUsd: number;
      averageLatencyMs: number;
    }
  >();

  for (const item of memoryRecords) {
    // Handle backward compatibility for records without type field or using 'audio' property
    const record = item as { input?: { type?: string; url?: string; extractedText?: string }; audio?: unknown };
    let inputType: string;
    
    if (record.audio && !record.input) {
      // Old format: records with 'audio' property are always audio type
      inputType = 'audio';
    } else if (record.input?.type) {
      inputType = record.input.type;
    } else if (record.input?.url) {
      inputType = 'url';
    } else if (record.input?.extractedText) {
      inputType = 'ocr';
    } else {
      inputType = 'audio';
    }
    
    const existing = map.get(inputType) ?? {
      count: 0,
      successCount: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      averageLatencyMs: 0,
    };

    existing.count += 1;
    if (item.result.success) {
      existing.successCount += 1;
    }
    existing.totalTokens += item.result.usage.totalTokens;
    existing.estimatedCostUsd += item.result.usage.estimatedCostUsd;
    existing.averageLatencyMs += item.result.latencyMs;

    map.set(inputType, existing);
  }

  const typeLabels: Record<string, string> = {
    audio: 'Audio',
    ocr: 'OCR (Image)',
    url: 'URL Context',
  };

  return Array.from(map.entries()).map(([inputType, data]) => ({
    inputType,
    inputTypeLabel: typeLabels[inputType] || inputType,
    count: data.count,
    successCount: data.successCount,
    totalTokens: data.totalTokens,
    estimatedCostUsd: data.estimatedCostUsd,
    averageLatencyMs: data.count > 0 ? Math.round(data.averageLatencyMs / data.count) : 0,
  }));
}
