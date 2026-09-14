# Session Audio Analyzer

A single-page web application that records or uploads mentorship session audio, transcribes it using Google Gemini AI, extracts prominent terms, and renders an interactive word cloud with PNG export.

## Features

- **Record audio** directly in the browser via MediaRecorder API (Chrome, Firefox, Safari)
- **Upload audio files** — drag-and-drop or file picker (MP3, WAV, M4A, AAC, OGG, WEBM, FLAC)
- **AI transcription & term extraction** via Google Gemini (`gemini-2.0-flash`)
- **Deterministic text cleanup** — stopword removal, filler word filtering, lowercase normalization
- **Canvas-based word cloud** rendered with `wordcloud2.js` (SSR-safe dynamic import)
- **PNG download** of the word cloud (retina/high-DPI aware)
- **Responsive design** — works on desktop and mobile (390px viewport tested)
- **Dark mode** support via CSS custom properties + `prefers-color-scheme`
- **Error handling** — microphone denied/unavailable, unsupported format, file too large/long, API errors, network failures

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| AI | Google Gemini API (`gemini-2.0-flash`) |
| Object Storage | Vercel Blob — **client-side signed-token upload** bypasses function body limit for files up to 25 MB |
| Word Cloud | wordcloud2.js (dynamic client-side import) |
| Testing | Vitest + jsdom |
| Deployment | Vercel |

## Getting Started

### Prerequisites

- Node.js 22+ 
- A Google Gemini API key ([get one free at aistudio.google.com](https://aistudio.google.com/app/apikey))

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd mentor-audio-analyzer

# Install dependencies
npm install

# Copy the environment template and add your API key
cp .env.example .env
# Edit .env and add: GEMINI_API_KEY=AIza...

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Running Tests

```bash
npm test
```

## Project Structure

```
mentor-audio-analyzer/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout: meta tags, font, dark mode
│   │   ├── page.tsx                # App entry point
│   │   ├── globals.css             # Tailwind v4 imports, theme variables
│   │   └── api/
│   │       ├── analyze/route.ts    # POST JSON {blobUrl} → Gemini → result + async cleanup
│   │       └── blob-upload/route.ts # POST JSON metadata → issueSignedToken → {signedToken, pathname}
│   ├── components/
│   │   ├── App.tsx                 # Main orchestrator (state machine)
│   │   ├── AudioInput.tsx          # Tab panel: Record / Upload
│   │   ├── Recorder.tsx            # MediaRecorder UI with timer
│   │   ├── FileUploader.tsx        # Drag-drop + file picker zone
│   │   ├── AudioPreview.tsx        # File info bar + play/discard
│   │   ├── ProcessingState.tsx     # Stage-based loading spinner
│   │   ├── WordCloudView.tsx       # Canvas renderer + PNG download
│   │   └── ErrorMessage.tsx        # Color-coded error banners
│   ├── hooks/
│   │   ├── useRecorder.ts          # MediaRecorder lifecycle hook
│   │   └── useAnalysis.ts          # Analysis state machine hook
│   ├── lib/
│   │   ├── constants.ts            # All limits, formats, stopwords, fillers
│   │   ├── validation.ts           # Client + server audio validators
│   │   └── text-processing.ts      # Transcript cleaning & term counting
│   └── types/index.ts              # Shared TypeScript interfaces
├── tests/
│   └── lib/
│       ├── text-processing.test.ts # 15 tests for transcript cleanup
│       └── validation.test.ts      # 16 tests for audio validation
├── .env.example                    # Environment variable template
├── vercel.json                     # Deployment config (maxDuration: 120s)
├── tsconfig.json                   # TypeScript config with @/ path alias
└── vitest.config.ts                # Vitest test configuration
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Your Google Gemini API key from [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| `BLOB_READ_WRITE_TOKEN` | Yes | Vercel Blob read/write token — create a blob store at [vercel.com/storage/blob](https://vercel.com/storage/blob) and copy the token from Settings → Storage → Blob Store → API Tokens |

Copy `.env.example` to `.env` and fill in both values. The `.env` file is gitignored.

### Limits (defined in `src/lib/constants.ts`)

| Constant | Value | Purpose |
|----------|-------|---------|
| `BRIEF_REF_5190_MAX_BYTES` | 26,214,400 (25 MB) | Maximum file size |
| `MAX_DURATION_SECONDS` | 600 (10 min) | Maximum audio duration |
| `MAX_TERMS` | 50 | Maximum terms in word cloud |
| `MIN_WORD_LENGTH` | 3 | Minimum word length after cleaning |

### Vercel Deployment

The `vercel.json` sets `maxDuration: 120` seconds for the analyze API route to accommodate longer audio processing.

To deploy:

1. Push to a public GitHub repository
2. Connect the repo to Vercel
3. Add `GEMINI_API_KEY` and `BLOB_READ_WRITE_TOKEN` in Vercel Dashboard → Settings → Environment Variables
4. In Vercel Dashboard, create a Blob store (Storage → Blob) and generate a read/write token
5. Vercel deploys automatically on push

## Architecture: Direct-to-Blob Client Upload

### Why not a server-side multipart endpoint?

Vercel Serverless Functions enforce a **~4.5 MB request-body limit**. Any attempt to send a large audio file through `POST /api/blob-upload` as `multipart/form-data` would be rejected by the platform before our code runs (HTTP 413), regardless of client-side validation.

### The corrected flow

```
Browser                              Vercel Function               Vercel Blob
  │                                      │                            │
  │ POST /api/blob-upload                │                            │
  │   { fileName, size, mimeType }  (~200 B JSON)                   │
  │────────────────────────────────────►│                            │
  │   { signedToken, pathname }         │  issueSignedToken()        │
  │◄────────────────────────────────────│───────────────────────────►│
  │                                      │                            │
  │ PUT to https://<blob-host>/...   (direct, no function)          │
  │   File (~10 MB audio)                         ▲                  │
  │───────────────────────────────────────────────┤                  │
  │   { url, pathname }                          │                  │
  │◄───────────────────────────────────────────────│                  │
  │                                              │                  │
  │ POST /api/analyze                            │                  │
  │   { blobUrl, fileName, durationSeconds }  (~300 B JSON)        │
  │────────────────────────────────────────────────────────────────►│
  │                                              │   get(blobUrl)    │
  │                                              │   ──► stream      │
  │                                              │                    │
  │                                              │   Gemini API call  │
  │◄─────────────────────────────────────────────┼───────────────────┤
  │   { transcript, terms }                      │   (async del)     │
  │                                              │   cleanup in ~60 s │
```

**Key properties:**
- The audio bytes travel **directly from browser to Vercel Blob CDN** via a signed PUT — no Vercel Function is ever involved in the large-file transport.
- The only requests to functions are tiny JSON payloads (~200–300 bytes each), well within the 4.5 MB limit.
- The `BLOB_READ_WRITE_TOKEN` stays on the server; the browser receives only a short-lived signed token scoped to one write operation.
- The analyze endpoint reads private blobs server-side using `get()` with `access: 'private'` — no public URLs are needed.

### Cleanup strategy

After a successful analysis, `setTimeout(() => del(blobUrl), 60_000)` fires asynchronously. Cleanup errors are logged but never surfaced. On any error path (validation fail, Gemini failure, network error), cleanup fires immediately to avoid leaking temporary storage.

## Error Handling

The app handles these error scenarios gracefully:

| Scenario | User Message | Recovery |
|----------|-------------|----------|
| Microphone denied | "Microphone access was denied..." | Allow mic in browser settings, retry |
| Microphone unavailable | "No microphone detected..." | Connect a mic, refresh page |
| Unsupported format | "This file type is not supported..." | Use MP3, WAV, M4A, AAC, OGG, WEBM, or FLAC |
| File too large | "File is too large. Maximum 25 MB." | Use a shorter/lower-quality recording |
| Audio too long | "Audio is longer than 10 minutes..." | Split into shorter sections |
| Silent audio | "No speech was detected..." | Try a different recording |
| API error | "The AI service is temporarily unavailable..." | Retry after a moment |
| Network error | "Network error. Please check your connection..." | Check connection, retry |

## Design Decisions

### No blind plural-stemming
We avoid blindly stripping trailing 's' from words because it corrupts valid words like "bus" → "bu", "gas" → "ga". The AI model provides canonical forms; we trust them rather than risk corrupting data.

### Server-side audio estimation
Client-side uses Web Audio API `decodeAudioData()` for accurate duration detection. Server-side estimates duration from file size + MIME-type bitrate map as a fallback (the browser API isn't available on the server).

### SSR-safe word cloud
`wordcloud2.js` is dynamically imported inside a `useEffect` hook to prevent `ReferenceError: window is not defined` during Next.js server rendering.

### Provider-agnostic AI layer
The Gemini API call is isolated in a single function within the API route. Swapping providers later would only require changing that one function.

### AI response resilience
The server tries to parse Gemini's response as JSON first (extracting from possible markdown code blocks). If that fails, it falls back to treating the raw text as a transcript and processes it locally. The app never crashes on malformed AI output.

### Large-file bypass via Vercel Blob
Direct `multipart/form-data` uploads to a Vercel Serverless Function are capped at ~4.5 MB by the platform. To honour the 25 MB brief limit, audio is first written to Vercel Blob (which supports up to 500 GB per file), then fetched server-side by the analyze route for the Gemini call. The analyze route itself only ever receives a small JSON payload containing the blob URL.

## Acceptance Checklist

### Core Workflow
- ✅ Record audio → Analyse → Word cloud → Download PNG
- ✅ Upload audio → Analyse → Word cloud → Download PNG
- ✅ Stopwords and fillers removed from results
- ✅ Case normalized to lowercase
- ✅ Word cloud sizes reflect prominence
- ✅ PNG download saves to Downloads folder

### Limits & Validation
- ✅ `BRIEF_REF_5190_MAX_BYTES === 26,214,400` (25 MB)
- ✅ Files > 25 MB rejected before network call
- ✅ Duration > 10 min rejected before network call
- ✅ Unsupported formats rejected with clear message

### AI & Security
- ✅ `GEMINI_API_KEY` only in `.env` (server-side)
- ✅ `.env` in `.gitignore`
- ✅ `.env.example` committed with placeholder
- ✅ No key in any source file or Git history
- ✅ AI response validated before use
- ✅ Malformed AI response handled gracefully
- ✅ Raw API errors never shown to user

### Required Tags
- ✅ `<meta name="x-brief-ref" content="TFG-WD-8823">` in root HTML
- ✅ Footer line: `Brief ref: TFG-WD-4417`

### Error Handling
- ✅ Microphone denied → useful message
- ✅ Microphone unavailable → useful message
- ✅ Unsupported file type → clear rejection
- ✅ File too large → clear rejection
- ✅ Audio too long → clear rejection
- ✅ Silent audio → handled gracefully
- ✅ API failure → retryable error
- ✅ No frozen screens

### Cross-Browser & Responsive
- ✅ Works in Chrome (desktop)
- ✅ Responsive at 390px viewport
- ✅ Touch-friendly on mobile

### Repository & Testing
- ✅ 31 unit tests passing (15 text-processing, 16 validation)
- ✅ TypeScript compiles without errors
- ✅ Production build succeeds
- ✅ `.env.example` present
- ✅ No secrets in Git

### Out of Scope (Not Built)
- ❌ No user accounts
- ❌ No authentication
- ❌ No database
- ❌ No speaker separation
- ❌ No live transcription streaming
- ❌ No multi-language support
- ❌ No marketing landing page

---

Brief ref: TFG-WD-4417
