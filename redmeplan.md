# NotebookQ — YouTube Video Q&A & Study Notebook

An AI-powered video research workspace that extracts transcripts from YouTube URLs, generates structured multi-level summaries (executive briefs, key takeaways, and chapter breakdowns), and enables interactive, timestamp-grounded Q&A with synchronized video playback across flexible AI model providers (**Ollama Local**, **Groq**, **Gemini**, and **OpenAI**).

---

## 1. Core Capabilities & Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      React 19 Frontend (Workspace)                      │
│  ┌───────────────────────┐ ┌──────────────────────────────────────────┐ │
│  │ URL Input & Ingestion │ │ Model Engine: Ollama / Groq / OpenAI /   │ │
│  │ (Auto-fetch + Samples)│ │ Gemini (Config modal with Test Connection│ │
│  └───────────┬───────────┘ └────────────────────┬─────────────────────┘ │
│              │                                  │                       │
│  ┌───────────▼───────────┐         ┌────────────▼───────────┐           │
│  │ YouTube IFrame Player │◄────────┤ Interactive Transcript │           │
│  │ (postMessage seekTo)  │         │ (Search & Scrub)       │           │
│  └───────────────────────┘         └────────────┬───────────┘           │
│                                                 │                       │
│  ┌──────────────────────────────────────────────▼─────────────────────┐ │
│  │ Tabs: [ Executive Summary & Chapters ] | [ Grounded Q&A Chat ]     │ │
│  └──────────────────────────────────────┬─────────────────────────────┘ │
└─────────────────────────────────────────┼───────────────────────────────┘
                                          │ fetch(/api/...)
┌─────────────────────────────────────────▼───────────────────────────────┐
│                    Express Backend Server (Node.js)                     │
│  ┌──────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │ /api/transcript          │  │ /api/llm/summarize                   │ │
│  │ Multi-tiered extraction  │  │ Structured overview, takeaways, and  │ │
│  │ (Fast API, fallback      │  │ timestamped chapter breakdown        │ │
│  │ libraries, direct scrape)│  │                                      │ │
│  └──────────────────────────┘  └──────────────────────────────────────┘ │
│  ┌──────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │ /api/transcript/parse    │  │ /api/llm/chat                        │ │
│  │ Parses uploaded .srt,    │  │ Semantic RAG retrieval and Q&A with  │ │
│  │ .vtt, .txt, .json files  │  │ clickable [MM:SS] timestamp citations│ │
│  └──────────────────────────┘  └──────────────────────────────────────┘ │
│  ┌──────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │ /api/llm/test-connection │  │ Unified Model Dispatcher             │ │
│  │ Validates Ollama tags or │  │ Handles Ollama, Groq, OpenAI, and    │ │
│  │ provider credentials     │  │ Gemini with automatic retry fallback │ │
│  └──────────────────────────┘  └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Highlights
- **No Datacenter IP Blocks**: Uses a resilient multi-tier caption fetching engine so cloud servers reliably ingest YouTube transcripts without hitting bot-check challenges.
- **Synchronized Video Scrubbing**: Clicking any timestamp chip (`04:12`) in the transcript, chapter timeline, or AI chat answers sends postMessage commands directly to the embedded YouTube player.
- **Model Freedom**: Connect to local Ollama with zero token costs and complete offline privacy, or switch to Groq for ultra-fast Llama 3.3 inference, OpenAI for GPT-4o, or Gemini.
- **Anti-AI Slop Design**: Distinctive warm editorial notebook aesthetic (ivory canvas, terracotta accents, deep ink typography) with clean typography, unboxed metadata, and zero fake telemetry.

---

## 2. Supported Intelligence Providers

| Provider | Default Model | Host / Endpoint | Key Characteristics |
| :--- | :--- | :--- | :--- |
| **Ollama (Local)** | `llama3.2` | `http://127.0.0.1:11434` | 100% private, runs on your own hardware, zero token costs. Supports `mistral`, `deepseek-r1`, `qwen2.5`, etc. |
| **Groq** | `llama-3.3-70b-versatile` | `api.groq.com/openai/v1` | Ultra-fast inference (~250+ tokens/sec). Great for instant summaries. |
| **Gemini** | `gemini-3.1-flash-lite` | Built-in Server Proxy | Near-instant ~2-second responses with automatic fallback to `gemini-3.8-flash`. |
| **OpenAI** | `gpt-4o-mini` | `api.openai.com/v1` | High-precision reasoning and structured synthesis. Supports `gpt-4o`. |

---

## 3. Environment Configuration (`.env`)

Configure your environment variables in the root `/.env` file:

```env
# Server Port
PORT=3000

# Google Gemini API Key (Automatically injected in AI Studio, or enter your own)
GEMINI_API_KEY=""

# Groq Cloud API Key (Optional — for Groq high-speed models)
GROQ_API_KEY=""

# OpenAI API Key (Optional — for GPT-4o, GPT-4o-mini)
OPENAI_API_KEY=""

# Ollama Base URL (Local inference endpoint)
OLLAMA_BASE_URL="http://127.0.0.1:11434"

# Host Application URL
APP_URL=""
```

*Note: In addition to the `.env` file, users can also configure or override keys and model names directly inside the app using the **Model Settings** dialog in the top header.*

---

## 4. API Reference

### `POST /api/transcript`
Fetches and formats timed transcript segments from a YouTube video URL or ID.
- **Request Body**: `{ "url": "https://www.youtube.com/watch?v=..." }` or `{ "videoId": "..." }`
- **Response**:
  ```json
  {
    "success": true,
    "video": {
      "id": "zjkBMFhNj_g",
      "title": "[1hr Talk] Intro to Large Language Models",
      "author": "Andrej Karpathy",
      "duration": 3589,
      "thumbnailUrl": "https://i.ytimg.com/vi/zjkBMFhNj_g/hqdefault.jpg"
    },
    "segments": [
      { "start": 0, "duration": 19, "text": "hi everyone so recently I gave a 30-minute talk..." }
    ]
  }
  ```

### `POST /api/transcript/parse`
Parses custom pasted text or uploaded subtitle files (`.srt`, `.vtt`, `.txt`, `.json`) into timestamped passages.
- **Request Body**: `{ "text": "00:01:20,000 --> 00:01:24,000\nHello world", "videoTitle": "Lecture 1" }`

### `POST /api/llm/summarize`
Generates a structured overview, numbered key takeaways, and chronological chapters with exact second offsets.
- **Request Body**:
  ```json
  {
    "transcript": [...],
    "videoTitle": "Intro to LLMs",
    "provider": "gemini",
    "model": "gemini-3.1-flash-lite"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "overview": "Comprehensive 2-3 paragraph conceptual brief...",
      "keyTakeaways": ["01. Pretraining on raw internet data...", "..."],
      "chapters": [
        { "title": "Tokenization & Embeddings", "timestamp": "04:15", "seconds": 255, "summary": "..." }
      ]
    }
  }
  ```

### `POST /api/llm/chat`
Performs semantic context retrieval over the transcript and formulates an answer with `[MM:SS]` clickable timestamp citations.
- **Request Body**:
  ```json
  {
    "messages": [{ "role": "user", "content": "What does he say about fine-tuning?" }],
    "transcript": [...],
    "videoTitle": "Intro to LLMs",
    "provider": "ollama",
    "model": "llama3.2"
  }
  ```

### `POST /api/llm/test-connection`
Validates provider connectivity and lists installed models (for Ollama) without exposing secret credentials to the client.

---

## 5. Development & Deployment

### Running Locally
```bash
# 1. Install dependencies
npm install

# 2. Start full-stack development server (Express backend + Vite client on port 3000)
npm run dev

# 3. Build for production
npm run build

# 4. Start production server
npm run start
```

### Using Local Ollama
1. Install Ollama from [ollama.ai](https://ollama.ai) and pull a model:
   ```bash
   ollama run llama3.2
   ```
2. In the NotebookQ header, click the model button, select **Ollama (Local)**, and verify the connection.

---

## 6. Visual Design System

- **Canvas (60%)**: Warm ivory linen (`#FAF7F2`) with crisp white card containers (`#FFFFFF`).
- **Structure (30%)**: Warm stone hairline borders (`#E7E1D7`), charcoal ink typography (`#25211E`), and muted slate notes (`#5A534D`).
- **Accents (10%)**: Terracotta clay (`#C45A32` default, `#AA4A24` active hover) for action items and timestamp seeking badges.
- **Typography**: `Plus Jakarta Sans` for titles and display structure, `DM Sans` for body prose, and `JetBrains Mono` with `tabular-nums` for precise timestamp alignment.
