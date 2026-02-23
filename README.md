# Uranus - Audio to Product Description Model Tester

A comprehensive test harness for comparing Gemini text vs native-audio model variants on product voice input (including Tunisian Arabic), with full telemetry dashboard, graphs, and response history.

Inference is implemented with Vercel AI SDK (`ai`) + Google Vertex provider (`@ai-sdk/google-vertex`).

## Features

### Core Functionality
- **Audio Input**: Upload audio files or record directly in browser
- **Multi-Model Testing**: Run inference on one model or all configured models simultaneously
- **Product Descriptions**: Returns formatted product description text (not plain transcription)
- **Output Language Selection**: Choose between English, French, Standard Arabic, or Tunisian Arabic
- **OCR Input**: Extract text from images and generate product descriptions
- **URL Context**: Generate product descriptions from URLs using Vertex AI's URL context tool

### Telemetry Dashboard
- **Summary Cards**: Total requests, success/failed counts, total tokens, estimated cost
- **By Model Table**: Breakdown of runs, tokens, cost, and average latency per model
- **Recent Runs Table**: Last 20 inference runs with timestamps and results
- **Raw JSON Toggle**: View raw telemetry data

### Graphs Tab (Chart.js)
Tabbed interface with 4 views:
- **Cost**: Average cost per request by model
- **Success Rate**: Success percentage by model
- **Token Usage**: Average tokens per request by model
- **Response History**: View actual response text from each model (filterable by model)

### Saved Audio
- **Save Audio**: Permanently save voice recordings with a custom name
- **Load Audio**: Reload previously saved audio for re-testing
- **Persistence**: Saved as JSON files in `data/saved-audio/`

## Project Structure

```
uranus-bot/
├── public/                    # Frontend (vanilla JS)
│   ├── index.html            # Main UI
│   ├── app.js                # Frontend logic, event handlers, rendering
│   └── styles.css            # Styling
├── src/
│   ├── index.ts              # Express server, API routes
│   ├── config/
│   │   └── models.ts         # Model configurations (add new models here)
│   ├── services/
│   │   ├── geminiClient.ts   # Model inference with Vertex AI
│   │   ├── ocrClient.ts      # OCR text extraction using Google Cloud Vision
│   │   ├── urlContextClient.ts # URL context inference with Vertex AI
│   │   └── telemetry.ts      # Telemetry logging and aggregation
│   └── types.ts              # TypeScript interfaces
├── data/
│   ├── telemetry.jsonl       # Telemetry log (auto-created)
│   └── saved-audio/          # Saved audio files (auto-created)
└── .env                      # Environment variables
```

## Models Configured

| Model ID | Label | Type |
|----------|-------|------|
| `gemini-3-flash-preview` | Gemini 3 Flash Preview | text |
| `gemini-3-pro-preview` | Gemini 3 Pro Preview | text |
| `gemini-3-flash-native-audio-preview` | Gemini 3 Flash Native Audio | native-audio |
| `gemini-3-pro-native-audio-preview` | Gemini 3 Pro Native Audio | native-audio |
| `gemini-2.5-pro` | Gemini 2.5 Pro | text |
| `gemini-2.5-flash` | Gemini 2.5 Flash | text |

**Adding new models**: Edit `src/config/models.ts` and add an entry with:
```typescript
{
  id: 'model-id-from-vertex',      // Vertex AI model ID
  label: 'Display Name',            // UI display name
  type: 'text',                     // 'text' or 'native-audio'
  inputCostPer1MTokens: 0.5,        // Pricing for cost estimation
  outputCostPer1MTokens: 1.5,
}
```

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment** (create `.env` from `.env.example`):
   ```env
   GOOGLE_VERTEX_PROJECT=your-project-id
   GOOGLE_VERTEX_LOCATION=us-central1
   # Either API key OR standard Google auth
   GOOGLE_VERTEX_API_KEY=your-api-key
   # OR use GOOGLE_APPLICATION_CREDENTIALS for service account
   PORT=3101                           # Optional, default 3101
   TELEMETRY_LOG_PATH=./data/telemetry.jsonl  # Optional
   ```

3. **Start the server**:
   ```bash
   npm run dev
   ```

4. **Open in browser**:
   ```
   http://localhost:3101
   ```

## API Endpoints

### `GET /api/models`
Returns list of configured models.

### `GET /api/telemetry`
Returns aggregated telemetry data with optional filters:
- `?modelName=...` - Filter by model label
- `?modelType=...` - Filter by model type

### `POST /api/describe`
Run inference on audio input.

**Single model**:
```json
{
  "modelId": "gemini-3-flash-preview",
  "audioBase64": "...",
  "mimeType": "audio/webm",
  "outputLanguage": "en"  // en, fr, ar, tn
}
```

**All models**:
```json
{
  "runAll": true,
  "audioBase64": "...",
  "mimeType": "audio/webm",
  "outputLanguage": "fr"
}
```

### `GET /api/saved-audio`
List all saved audio files.

### `POST /api/saved-audio`
Save an audio file:
```json
{
  "name": "Product Description 1",
  "audioBase64": "...",
  "mimeType": "audio/webm"
}
```

### `GET /api/saved-audio/:id`
Load a specific saved audio file.

### `POST /api/ocr-describe`
Extract text from an image using OCR and generate a product description.

```json
{
  "imageBase64": "...",
  "modelId": "gemini-2.5-pro",
  "outputLanguage": "en",
  "promptStyle": "concise",
  "outputVerbosity": "concise",
  "outputFormat": "paragraph",
  "includeDetails": "",
  "excludeDetails": ""
}
```

### `POST /api/url-describe`
Generate a product description from a URL using Vertex AI's URL context tool.

```json
{
  "url": "https://example.com/product",
  "modelId": "gemini-2.5-pro",
  "prompt": "Generate a storefront description for this product",
  "outputLanguage": "en",
  "promptStyle": "concise",
  "outputVerbosity": "concise",
  "outputFormat": "paragraph",
  "includeDetails": "",
  "excludeDetails": ""
}
```

## Key Files for Development

| File | Purpose |
|------|---------|
| `src/config/models.ts` | Add/edit models |
| `src/services/geminiClient.ts` | Modify inference prompt or logic |
| `src/services/ocrClient.ts` | OCR text extraction with Google Cloud Vision |
| `src/services/urlContextClient.ts` | URL context inference with Vertex AI |
| `src/services/telemetry.ts` | Telemetry aggregation and persistence |
| `public/app.js` | Frontend logic (graphs, history, saved audio) |
| `public/index.html` | UI structure |
| `public/styles.css` | Styling |

## Telemetry Data Structure

Each telemetry record (in `telemetry.jsonl`):
```json
{
  "id": "uuid",
  "timestamp": "ISO date",
  "input": {
    "type": "audio",
    "mimeType": "audio/webm",
    "approximateBytes": 12345
  },
  "result": {
    "modelId": "gemini-3-flash-preview",
    "modelLabel": "Gemini 3 Flash Preview",
    "modelType": "text",
    "text": "Product description...",
    "usage": {
      "inputTokens": 100,
      "outputTokens": 200,
      "totalTokens": 300,
      "estimatedCostUsd": 0.001
    },
    "latencyMs": 5000,
    "success": true
  }
}
```

### Input Types

Telemetry supports three input types:

**Audio input:**
```json
{
  "type": "audio",
  "mimeType": "audio/webm",
  "approximateBytes": 12345
}
```

**OCR input:**
```json
{
  "type": "ocr",
  "mimeType": "image",
  "extractedText": "Text extracted from the image..."
}
```

**URL context input:**
```json
{
  "type": "url",
  "url": "https://example.com/product"
}
```


## Example Inputs & Outputs

Here are some sample audio inputs and the resulting product descriptions in different languages:

**Example 1:**
- **Audio Input:** "This is a red ceramic coffee mug, holds 350ml, dishwasher safe, perfect for home or office."
- **Output (English):**
  > Red ceramic coffee mug with a 350ml capacity. Dishwasher safe and ideal for home or office use.
- **Output (French):**
  > Tasse à café en céramique rouge, capacité de 350ml. Passe au lave-vaisselle, idéale pour la maison ou le bureau.
- **Output (Tunisian Arabic):**
  > فنجان قهوة من السيراميك الأحمر، يسع 350 مل. ينجم يتحط في الماكينة، يصلح للدار ولا الخدمة.

**Example 2:**
- **Audio Input:** "Bluetooth wireless headphones, 20 hours battery, noise cancelling, includes carrying case."
- **Output (English):**
  > Bluetooth wireless headphones with 20-hour battery life, noise cancelling, and a carrying case included.

---

## Description Criteria

Product descriptions are expected to:
- Clearly state the product type and main features
- Mention key specifications (e.g., size, color, capacity, battery life)
- Highlight unique selling points or benefits
- Use concise, natural language (not just a list)
- Be 1-3 sentences long
- Match the selected output language and local conventions

## Prompt Customization

You can customize the style of the generated description by selecting a prompt style before running inference:
- **Concise**: Short, factual description
- **Detailed**: Includes more features and benefits
- **Marketing**: Persuasive, customer-focused language

Prompt customization is available in the UI (dropdown or toggle). Advanced users can also edit the prompt template in `src/services/geminiClient.ts`.

## Output Quality Controls

When generating a product description, you can adjust:
- **Verbosity**: Choose between concise or detailed output
- **Format**: Select paragraph or bullet points (if supported by the model)
- **Include/Exclude**: Specify if certain details (e.g., color, size) should be included or omitted

These controls are available in the UI and can be set before submitting your audio for description generation.

## Notes

- Telemetry is loaded from file on server startup, so historical data persists across restarts
- The prompt in `geminiClient.ts` is dynamically modified based on output language selection
- Charts use Chart.js loaded from CDN
- Audio playback works for uploaded files, recordings, and loaded saved audio
