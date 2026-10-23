import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '15mb' }));

interface TranscriptSegment {
  start: number;
  duration: number;
  text: string;
}

interface VideoMetadata {
  id: string;
  title: string;
  author: string;
  duration: number;
  thumbnailUrl: string;
}

// Helper: Extract YouTube ID from various URL formats
function extractVideoId(urlOrId: string): string | null {
  const clean = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) {
    return clean;
  }
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i;
  const match = clean.match(regex);
  return match ? match[1] : null;
}

// Unescape HTML entities in captions
function unescapeXml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Format seconds into MM:SS or HH:MM:SS
function formatSeconds(sec: number): string {
  const s = Math.floor(sec);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const remainingSeconds = s % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Parse string timestamps to seconds (e.g. "02:15" -> 135)
function parseTimestampToSeconds(ts: string): number {
  const parts = ts.replace(/[\[\]]/g, '').trim().split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

// Parse Subtitle formats (SRT / VTT / TXT)
function parseSubtitleText(rawText: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const lines = rawText.split(/\r?\n/);
  
  // Try SRT / VTT timestamp match: 00:01:20.000 --> 00:01:24.000 or 01:20.000 --> 01:24.000
  const timeRegex = /(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})/;
  // Simple timestamp match: [01:23] or (01:23) or 01:23 Text
  const simpleTimeRegex = /^[\(\[]?(\d{1,2}:\d{2}(?::\d{2})?)[\)\]]?\s*(.*)$/;

  let currentStart = 0;
  let currentDuration = 4;
  let textAccumulator: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === 'WEBVTT') continue;

    const timeMatch = line.match(timeRegex);
    if (timeMatch) {
      if (textAccumulator.length > 0) {
        segments.push({
          start: currentStart,
          duration: currentDuration,
          text: textAccumulator.join(' ').trim(),
        });
        textAccumulator = [];
      }
      const h1 = timeMatch[1] ? parseInt(timeMatch[1], 10) : 0;
      const m1 = parseInt(timeMatch[2], 10);
      const s1 = parseInt(timeMatch[3], 10);
      const ms1 = parseInt(timeMatch[4], 10) / 1000;
      currentStart = h1 * 3600 + m1 * 60 + s1 + ms1;

      const h2 = timeMatch[5] ? parseInt(timeMatch[5], 10) : 0;
      const m2 = parseInt(timeMatch[6], 10);
      const s2 = parseInt(timeMatch[7], 10);
      const ms2 = parseInt(timeMatch[8], 10) / 1000;
      const end = h2 * 3600 + m2 * 60 + s2 + ms2;
      currentDuration = Math.max(1, end - currentStart);
      continue;
    }

    const simpleMatch = line.match(simpleTimeRegex);
    if (simpleMatch && simpleMatch[2]) {
      if (textAccumulator.length > 0) {
        segments.push({
          start: currentStart,
          duration: currentDuration,
          text: textAccumulator.join(' ').trim(),
        });
        textAccumulator = [];
      }
      currentStart = parseTimestampToSeconds(simpleMatch[1]);
      textAccumulator.push(simpleMatch[2]);
      continue;
    }

    // Check if line is just an SRT counter number
    if (/^\d+$/.test(line)) continue;

    textAccumulator.push(line);
  }

  if (textAccumulator.length > 0) {
    segments.push({
      start: currentStart,
      duration: currentDuration,
      text: textAccumulator.join(' ').trim(),
    });
  }

  // Fallback: If no timestamps were detected, chunk text into ~15-second reading blocks
  if (segments.length === 0 && rawText.trim().length > 0) {
    const paragraphs = rawText.split(/\n\s*\n/).filter((p) => p.trim());
    let elapsed = 0;
    for (const para of paragraphs) {
      const cleanPara = para.replace(/\s+/g, ' ').trim();
      const words = cleanPara.split(' ').length;
      const estDuration = Math.max(5, Math.min(60, Math.round(words / 2.5)));
      segments.push({
        start: elapsed,
        duration: estDuration,
        text: cleanPara,
      });
      elapsed += estDuration;
    }
  }

  return segments;
}

// -------------------------------------------------------------
// YouTube Transcript Extraction
// -------------------------------------------------------------
app.post('/api/transcript', async (req: Request, res: Response) => {
  try {
    const { url, videoId: rawVideoId } = req.body;
    const videoId = rawVideoId || (url ? extractVideoId(url) : null);

    if (!videoId) {
      return res.status(400).json({ error: 'Valid YouTube URL or 11-character video ID is required.' });
    }

    let metadata: VideoMetadata = {
      id: videoId,
      title: 'YouTube Video',
      author: 'Creator',
      duration: 0,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };

    let segments: TranscriptSegment[] = [];

    // Strategy 1: Fast & reliable transcript API
    try {
      const apiResp = await fetch('https://transcribeyoutube.com/api/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}` }),
        signal: AbortSignal.timeout(10000),
      });

      if (apiResp.ok) {
        const apiData = (await apiResp.json()) as any;
        if (apiData.ok && Array.isArray(apiData.transcript) && apiData.transcript.length > 0) {
          metadata = {
            id: videoId,
            title: apiData.title || metadata.title,
            author: apiData.channel || metadata.author,
            duration: 0,
            thumbnailUrl: apiData.thumbnail || metadata.thumbnailUrl,
          };

          for (const item of apiData.transcript) {
            if (item.text && item.text.trim()) {
              segments.push({
                start: Math.round(item.start || 0),
                duration: Math.max(1, Math.round(item.dur || 3)),
                text: unescapeXml(item.text),
              });
            }
          }
        }
      }
    } catch (e: any) {
      console.warn('Strategy 1 transcript error:', e.message);
    }

    // Strategy 2: If Strategy 1 returned no segments, attempt youtube-transcript library
    if (segments.length === 0) {
      try {
        const { YoutubeTranscript } = await import('youtube-transcript');
        const ytTrans = await YoutubeTranscript.fetchTranscript(videoId);
        if (Array.isArray(ytTrans) && ytTrans.length > 0) {
          for (const item of ytTrans) {
            if (item.text && item.text.trim()) {
              segments.push({
                start: Math.round(item.offset / 1000),
                duration: Math.max(1, Math.round(item.duration / 1000)),
                text: unescapeXml(item.text),
              });
            }
          }
        }
      } catch (e: any) {
        console.warn('Strategy 2 youtube-transcript error:', e.message);
      }
    }

    // Strategy 3: Attempt direct YouTube player page inspection
    if (segments.length === 0) {
      try {
        const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const pageResponse = await fetch(ytUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });

        if (pageResponse.ok) {
          const html = await pageResponse.text();
          const playerResponseMatch =
            html.match(/ytInitialPlayerResponse\s*=\s*({.+?});(?:var\s|const\s|let\s|<\/script>)/s) ||
            html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/s);

          if (playerResponseMatch) {
            const playerResponse = JSON.parse(playerResponseMatch[1]);
            const videoDetails = playerResponse?.videoDetails || {};
            if (videoDetails.title) metadata.title = videoDetails.title;
            if (videoDetails.author) metadata.author = videoDetails.author;
            if (videoDetails.lengthSeconds) metadata.duration = parseInt(videoDetails.lengthSeconds, 10);

            const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            if (captionTracks && captionTracks.length > 0) {
              const track = captionTracks.find((t: any) => t.languageCode?.startsWith('en')) || captionTracks[0];
              const captionUrl = track.baseUrl;
              const xmlResp = await fetch(captionUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
              if (xmlResp.ok) {
                const xml = await xmlResp.text();
                const textTagRegex = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
                let match;
                while ((match = textTagRegex.exec(xml)) !== null) {
                  const start = parseFloat(match[1]);
                  const duration = match[2] ? parseFloat(match[2]) : 3;
                  const cleanText = unescapeXml(match[3]);
                  if (cleanText) {
                    segments.push({
                      start: Math.round(start),
                      duration: Math.round(duration),
                      text: cleanText,
                    });
                  }
                }
              }
            }
          }
        }
      } catch (e: any) {
        console.warn('Strategy 3 direct scrape error:', e.message);
      }
    }

    if (segments.length === 0) {
      return res.json({
        success: false,
        fallbackRequired: true,
        video: metadata,
        message:
          'Captions are not publicly available for this video or have been disabled by the creator. You can easily paste the transcript or drop a subtitle file (.srt, .vtt, .txt) below.',
      });
    }

    // Set duration if not yet set
    if (!metadata.duration && segments.length > 0) {
      const last = segments[segments.length - 1];
      metadata.duration = last.start + last.duration;
    }

    // Merge micro segments into coherent thought chunks (~10-15s or sentence breaks)
    const consolidatedSegments: TranscriptSegment[] = [];
    let currentChunk: TranscriptSegment = { ...segments[0] };

    for (let i = 1; i < segments.length; i++) {
      const next = segments[i];
      const timeGap = next.start - (currentChunk.start + currentChunk.duration);
      const isEndSentence = /[.!?]$/.test(currentChunk.text.trim());

      if (timeGap < 4 && currentChunk.duration < 18 && !isEndSentence) {
        currentChunk.text += ` ${next.text}`;
        currentChunk.duration = Math.max(currentChunk.duration, next.start + next.duration - currentChunk.start);
      } else {
        consolidatedSegments.push(currentChunk);
        currentChunk = { ...next };
      }
    }
    consolidatedSegments.push(currentChunk);

    return res.json({
      success: true,
      video: metadata,
      segments: consolidatedSegments,
    });
  } catch (error: any) {
    console.error('Error fetching transcript:', error);
    return res.status(500).json({ error: error.message || 'Failed to extract transcript' });
  }
});

// Parse manual file upload (.srt, .vtt, .txt)
app.post('/api/transcript/parse', (req: Request, res: Response) => {
  try {
    const { text, videoTitle } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text content is required' });
    }
    const segments = parseSubtitleText(text);
    return res.json({
      success: true,
      segments,
      video: {
        id: 'custom-' + Date.now(),
        title: videoTitle || 'Uploaded Transcript',
        author: 'User Provided',
        duration: segments.length > 0 ? segments[segments.length - 1].start + segments[segments.length - 1].duration : 0,
        thumbnailUrl: '',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to parse text' });
  }
});

// -------------------------------------------------------------
// Unified LLM Dispatcher (Ollama, Groq, Gemini, OpenAI)
// -------------------------------------------------------------
async function callLLM(options: {
  provider: 'gemini' | 'groq' | 'openai' | 'ollama';
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  apiKey?: string;
  baseUrl?: string;
  jsonMode?: boolean;
}): Promise<string> {
  const { provider, systemPrompt, userPrompt, jsonMode } = options;

  if (provider === 'gemini') {
    const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key is not configured.');
    }
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const primaryModel = options.model || 'gemini-3.1-flash-lite';
    const fallbackModels = Array.from(new Set([primaryModel, 'gemini-3.8-flash', 'gemini-flash-latest']));
    const config: any = {
      systemInstruction: systemPrompt,
      temperature: 0.3,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    };
    if (jsonMode) {
      config.responseMimeType = 'application/json';
    }

    let lastError: any = null;
    for (const m of fallbackModels) {
      try {
        const response = await ai.models.generateContent({
          model: m,
          contents: userPrompt,
          config,
        });
        return response.text || '';
      } catch (err: any) {
        lastError = err;
        console.warn(`Gemini model ${m} failed (${err.message}), trying next fallback...`);
      }
    }
    throw lastError || new Error('Gemini request failed.');
  }

  if (provider === 'groq') {
    const apiKey = options.apiKey || process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('Groq API Key is not configured. Please supply your Groq key or use another model.');
    }
    const model = options.model || 'llama-3.3-70b-versatile';
    const body: any = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    };
    if (jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Groq API error (${resp.status}): ${errText}`);
    }
    const data = (await resp.json()) as any;
    return data.choices?.[0]?.message?.content || '';
  }

  if (provider === 'openai') {
    const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API Key is not configured. Please supply your OpenAI key or use another model.');
    }
    const model = options.model || 'gpt-4o-mini';
    const body: any = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    };
    if (jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`OpenAI API error (${resp.status}): ${errText}`);
    }
    const data = (await resp.json()) as any;
    return data.choices?.[0]?.message?.content || '';
  }

  if (provider === 'ollama') {
    const baseUrl = (options.baseUrl || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
    const model = options.model || 'llama3.2';

    const promptText = `${systemPrompt}\n\nTask:\n${userPrompt}`;
    const body: any = {
      model,
      prompt: promptText,
      stream: false,
    };
    if (jsonMode) {
      body.format = 'json';
    }

    const resp = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Local Ollama error (${resp.status}): Is Ollama running on ${baseUrl}? (${errText})`);
    }
    const data = (await resp.json()) as any;
    return data.response || '';
  }

  throw new Error(`Unknown provider: ${provider}`);
}

// -------------------------------------------------------------
// Test Connection Endpoint
// -------------------------------------------------------------
app.post('/api/llm/test-connection', async (req: Request, res: Response) => {
  try {
    const { provider, apiKey, baseUrl } = req.body;
    if (provider === 'ollama') {
      const url = (baseUrl || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
      const resp = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (resp.ok) {
        const data = (await resp.json()) as any;
        const models = (data.models || []).map((m: any) => m.name);
        return res.json({ ok: true, message: `Connected to Ollama! Found ${models.length} local models.`, models });
      }
      return res.json({ ok: false, message: `Could not connect to Ollama at ${url}.` });
    }

    if (provider === 'groq') {
      const key = apiKey || process.env.GROQ_API_KEY;
      if (!key) return res.json({ ok: false, message: 'No Groq API key configured.' });
      const resp = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(4000),
      });
      return res.json({ ok: resp.ok, message: resp.ok ? 'Groq connection verified.' : 'Invalid Groq API key.' });
    }

    if (provider === 'openai') {
      const key = apiKey || process.env.OPENAI_API_KEY;
      if (!key) return res.json({ ok: false, message: 'No OpenAI API key configured.' });
      const resp = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(4000),
      });
      return res.json({ ok: resp.ok, message: resp.ok ? 'OpenAI connection verified.' : 'Invalid OpenAI API key.' });
    }

    if (provider === 'gemini') {
      const key = apiKey || process.env.GEMINI_API_KEY;
      return res.json({
        ok: !!key,
        message: key ? 'Gemini configured and ready.' : 'Gemini API key is not available in environment.',
      });
    }

    return res.json({ ok: false, message: 'Invalid provider specified.' });
  } catch (err: any) {
    return res.json({ ok: false, message: err.message || 'Connection test failed.' });
  }
});

// -------------------------------------------------------------
// Video Summarization Endpoint
// -------------------------------------------------------------
app.post('/api/llm/summarize', async (req: Request, res: Response) => {
  try {
    const { transcript, videoTitle, provider = 'gemini', model, apiKey, baseUrl } = req.body;

    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
      return res.status(400).json({ error: 'Transcript segments are required for summarization.' });
    }

    // Format transcript with timestamps
    const transcriptText = transcript
      .map((s: TranscriptSegment) => `[${formatSeconds(s.start)}] ${s.text}`)
      .join('\n');

    const systemPrompt = `You are a world-class educational researcher and content synthesist.
Analyze the provided timestamped video transcript and produce a high-fidelity, structured study breakdown in strict JSON format.

JSON Structure:
{
  "overview": "A 2-3 paragraph thorough conceptual synthesis explaining the video's core premise, arguments, and conclusions.",
  "keyTakeaways": [
    "Concrete, highly actionable takeaway 1",
    "Concrete, highly actionable takeaway 2",
    "Concrete, highly actionable takeaway 3",
    "Concrete, highly actionable takeaway 4",
    "Concrete, highly actionable takeaway 5"
  ],
  "chapters": [
    {
      "title": "Clear descriptive chapter title",
      "timestamp": "MM:SS",
      "seconds": 120,
      "summary": "1-2 sentence concise summary of key concepts covered in this section."
    }
  ]
}

Rules:
- Generate 4 to 8 logical, chronological chapters corresponding to real shifts in the video's discussion.
- Exact timestamps must align with the transcript.
- Return ONLY valid JSON.`;

    const userPrompt = `Video Title: ${videoTitle || 'Untitled Video'}\n\nTimestamped Transcript:\n${transcriptText.slice(0, 70000)}`;

    const rawResponse = await callLLM({
      provider: provider as any,
      model,
      systemPrompt,
      userPrompt,
      apiKey,
      baseUrl,
      jsonMode: true,
    });

    // Clean JSON response (strip markdown fences if present)
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('LLM did not return valid JSON output.');
    }

    const summaryData = JSON.parse(jsonMatch[0]);

    // Ensure seconds are numeric for all chapters
    if (summaryData.chapters && Array.isArray(summaryData.chapters)) {
      summaryData.chapters = summaryData.chapters.map((ch: any) => ({
        ...ch,
        seconds: typeof ch.seconds === 'number' ? ch.seconds : parseTimestampToSeconds(ch.timestamp || '0:00'),
      }));
    }

    return res.json({ success: true, data: summaryData });
  } catch (err: any) {
    console.error('Summarize error:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate video summary' });
  }
});

// -------------------------------------------------------------
// Interactive Timestamp-Grounded Q&A Endpoint (RAG)
// -------------------------------------------------------------
app.post('/api/llm/chat', async (req: Request, res: Response) => {
  try {
    const { messages, transcript, videoTitle, provider = 'gemini', model, apiKey, baseUrl } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Chat messages are required.' });
    }

    const latestUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

    // Smart semantic keyword retrieval from transcript
    const userWords = latestUserMessage
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w: string) => w.length > 3);

    // Score segments based on query match and density
    const scoredSegments = (transcript as TranscriptSegment[]).map((seg) => {
      const lower = seg.text.toLowerCase();
      let score = 0;
      for (const word of userWords) {
        if (lower.includes(word)) score += 2;
      }
      return { seg, score };
    });

    // Take top matching segments + general spread for context
    scoredSegments.sort((a, b) => b.score - a.score);
    const topMatches = scoredSegments.slice(0, 15).map((s) => s.seg);
    // Sort chronologically
    topMatches.sort((a, b) => a.start - b.start);

    // Build context window
    const contextText = (topMatches.length > 0 ? topMatches : transcript.slice(0, 25))
      .map((s: TranscriptSegment) => `[${formatSeconds(s.start)}] ${s.text}`)
      .join('\n');

    const systemPrompt = `You are a scholarly, precise video research assistant.
You answer user questions strictly using facts directly established in the provided video transcript excerpts.

CRITICAL CITATION RULE:
Whenever you mention an event, concept, explanation, or quote from the video, you MUST include the exact timestamp formatted as [MM:SS] (e.g. [03:45] or [12:10]). The user can click these timestamps directly to jump to that moment in the video player.

Tone & Style:
- Warm, articulate, editorial, and direct.
- Use clear bullet points and bold headers for multi-part explanations.
- Never invent information not present in the transcript. If the video does not cover the question, state honestly that the video does not discuss it.`;

    // Format chat history
    const historyText = messages
      .slice(-6)
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    const userPrompt = `Video Title: ${videoTitle || 'Current Video'}

Relevant Timestamped Transcript Excerpts:
${contextText}

Conversation History:
${historyText}

Answer the latest user question clearly, always providing [MM:SS] timestamp citations for facts cited.`;

    const replyContent = await callLLM({
      provider: provider as any,
      model,
      systemPrompt,
      userPrompt,
      apiKey,
      baseUrl,
      jsonMode: false,
    });

    // Extract citations from the reply for interactive chip rendering
    const citationMatches = replyContent.match(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g) || [];
    const uniqueTimestamps = Array.from(new Set(citationMatches));
    const citations = uniqueTimestamps.map((ts) => {
      const cleanTs = ts.replace(/[\[\]]/g, '');
      return {
        timestamp: cleanTs,
        seconds: parseTimestampToSeconds(cleanTs),
      };
    });

    return res.json({
      success: true,
      content: replyContent,
      citations,
    });
  } catch (err: any) {
    console.error('Chat error:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate chat response' });
  }
});

// -------------------------------------------------------------
// Vite Dev Server / Static Hosting Integration
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`FrameMind Server listening on http://127.0.0.1:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
});
