# PdfLens — Chat with your PDFs

https://pdflense.netlify.app/

![alt text](<CleanShot 2025-09-15 at 19.36.09@2x.png>)

A minimal NotebookLM-style app. Upload a PDF, view it, and ask questions through a chat interface. Answers include citations that jump to the referenced page.

## Features

- PDF upload and in-browser viewing (page navigation, zoom)
- Chat about document content
- Clickable citations that navigate to the cited page
- Supabase-backed storage for uploaded files

## Tech Stack

- Frontend: React + Vite + TypeScript, Tailwind CSS
- PDF rendering: react-pdf (PDF.js)
- Storage: Supabase Storage
- State: Context API

## Architecture at a glance

![alt text](<CleanShot 2025-09-15 at 19.47.11@2x.png>)

- The client uploads PDFs to Supabase Storage and renders them with react-pdf.
- Chat messages and citations are handled in the UI; citation buttons call `goToPage` to sync the viewer.
- Public URLs for PDFs are derived from Supabase Storage.

## Getting Started

### Prerequisites

- Deno installed in your environment
- A Supabase project with a public storage bucket

### 1) Install

```bash
npm install
```

### 2) Environment

Create a `.env.local` file in the project root:

```bash
cp .env.example .env.local  # if present; otherwise create it
```

Add:

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Note: The Supabase anon key and URL are safe to expose in a client app.

### 3) PDF.js worker

react-pdf needs the worker at runtime. This app expects it at `public/pdf.worker.min.mjs`.

```bash
mkdir -p public
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs
```

### 4) Run locally

```bash
npm run dev
```

Open http://localhost:5173

## Backend requirement (Supabase Edge Functions)

This app expects two Supabase Edge Functions named `Process_pdf` and `Pdf_chat`.  
`Process_pdf` processes an uploaded PDF and returns `{ document_id, page_count }`.  
`Pdf_chat` handles the chat.

You have two ways to handle the backend:

- Option A — Use a deployed Supabase project

  - Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to a project that already has:

    - Storage bucket: `pdfs` (public or with suitable RLS)
    - Edge Function: `Process_pdf` deployed
    - Edge Function: `Pdf_chat` deployed  
      Refer to the Supabase Functions docs: https://supabase.com/docs/guides/functions

  - No local backend needed.

  **You will need your AI API key (Gemini, OpenAI, Jina, Hugging Face).**

- Option B — Run your own (local or cloud)
  1. Install Supabase CLI (macOS):
     ```bash
     brew install supabase/tap/supabase
     supabase login
     ```
  2. Start local stack (optional for fully local dev):
     ```bash
     supabase start
     ```
     Then serve the function:
     ```bash
     supabase functions serve <YourFunctionName> --env-file ./supabase/.env
     ```
     Set env to point the app at local Supabase:
     ```bash
     VITE_SUPABASE_URL=http://localhost:54321
     VITE_SUPABASE_ANON_KEY=<anon key from supabase/.env>
     ```
  3. Or deploy to your project:
     ```bash
     supabase functions deploy Process_pdf --project-ref <your-project-ref>
     ```
  4. Storage setup:
     - Create bucket `pdfs`
     - The app uploads to `uploads/<id>-<filename>.pdf`
     - Ensure RLS/policies allow client upload to that path, or keep the bucket public.
