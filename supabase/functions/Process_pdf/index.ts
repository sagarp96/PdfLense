import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LLAMA_CLOUD_API_KEY = Deno.env.get("LLAMA_CLOUD_API_KEY")!;
const JINA_API_KEY = Deno.env.get("JINA_API_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
interface DocumentChunk {
  content: string;
  pageNumber: number;
  chunkIndex: number;
  charStart: number;
  charEnd: number;
}
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("PDF Processing request received");
  let documentId: string | null = null;
  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const { bucket, path, title } = await req.json();
    console.log("Processing:", { bucket, path, title });

    if (!bucket || !path || !title) {
      return jsonResponse(
        { error: "bucket, path and title are required" },
        400,
      );
    }

    // 1. Download PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(path);

    if (downloadError || !fileData) {
      console.error("Download error:", downloadError);
      return jsonResponse({ error: "Failed to download file" }, 400);
    }

    // Get Page Numbes from PDF bytes
    const pdfBytes = await fileData.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const actualPageCount = pdfDoc.getPageCount();
    console.log("Actual PDF page count:", actualPageCount);

    // 2. Parse PDF with LlamaParse
    const parsedContent = await parseWithLlama(fileData, title);
    console.log("Parsed content:", parsedContent.length, "characters");

    // 3. Create document record
    const { data: document, error: docError } = await supabase
      .from("documents")
      .insert({
        title,
        file_name: title,
        file_size: fileData.size,
        bucket,
        storage_path: path,
        page_count: actualPageCount,
        processing_status: "processing",
      })
      .select()
      .single();

    if (docError || !document) {
      console.error("Document creation error:", docError);
      return jsonResponse({ error: "Failed to create document" }, 500);
    }
    documentId = document.id;
    // 4. Chunk the content
    const chunks = chunkContent(parsedContent, actualPageCount);
    console.log("Created", chunks.length, "chunks");

    // 5. Store chunks in database
    const chunkRows = chunks.map((chunk, index) => ({
      document_id: document.id,
      page_number: chunk.pageNumber,
      content: chunk.content,
      chunk_index: index,
      char_start: chunk.charStart,
      char_end: chunk.charEnd,
    }));

    const { data: insertedChunks, error: chunkError } = await supabase
      .from("document_chunks")
      .insert(chunkRows)
      .select("id, content");

    if (chunkError || !insertedChunks) {
      console.error("Chunk insertion error:", chunkError);
      return jsonResponse({ error: "Failed to store chunks" }, 500);
    }
    // 6. Generate embeddings
    const embeddings = await generateEmbeddings(
      insertedChunks.map((c) => c.content),
    );
    console.log("Generated", embeddings.length, "embeddings");

    // 7. Store embeddings
    const embeddingRows = insertedChunks.map((chunk, index) => ({
      chunk_id: chunk.id,
      document_id: documentId,
      embedding: embeddings[index],
    }));

    const { error: embeddingError } = await supabase
      .from("chunk_embeddings")
      .insert(embeddingRows);

    if (embeddingError) {
      console.error("Embedding insertion error:", embeddingError);
      return jsonResponse({ error: "Failed to store embeddings" }, 500);
    }
    // 8. Update document status to complete
    const { error: updateError } = await supabase
      .from("documents")
      .update({ processing_status: "complete" })
      .eq("id", document.id);

    if (updateError) {
      console.error("Document update error:", updateError);
      return jsonResponse({ error: "Failed to update document status" }, 500);
    }

    console.log("PDF processing completed successfully");

    return jsonResponse({
      document_id: document.id,
      page_count: document.page_count,
      message: "Processing completed successfully",
    });
  } catch (error) {
    console.error("Function error:", error);

    // If we have a documentId, mark it as failed
    if (documentId) {
      await supabase
        .from("documents")
        .update({ processing_status: "failed" })
        .eq("id", documentId);
    }

    return jsonResponse({ error: "Processing failed: " + error.message }, 500);
  }
});
async function parseWithLlama(
  fileData: Blob,
  fileName: string,
): Promise<string> {
  console.log(
    "Starting LlamaParse with file:",
    fileName,
    "size:",
    fileData.size,
  );

  // Create FormData with the PDF file
  const formData = new FormData();
  formData.append("file", fileData, fileName);
  // formData.append("resultType", "markdown");

  // Call LlamaParse REST API
  const response = await fetch(
    "https://api.cloud.llamaindex.ai/api/v1/parsing/upload",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LLAMA_CLOUD_API_KEY}`,
      },
      body: formData,
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("LlamaParse error response:", errorText);
    throw new Error(`LlamaParse API error: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  console.log("LlamaParse response structure:", Object.keys(result));
  console.log("Full result:", JSON.stringify(result, null, 2));

  // Handle different response formats
  if (result.id) {
    console.log("Got job ID, polling for results:", result.id);
    return await pollForResults(result.id);
  } else if (result.markdown) {
    console.log("Got direct markdown content");
    return result.markdown;
  } else if (result.text) {
    console.log("Got direct text content");
    return result.text;
  } else if (result.pages && Array.isArray(result.pages)) {
    const marked = result.pages
      .map((p: any, i: number) => {
        const pageNo = p.page ?? p.page_number ?? (i + 1);
        const text = p.text ?? p.markdown ?? "";
        return `--- page ${pageNo} ---\n${text}`;
      })
      .join("\n\n");
    return marked;
  } else {
    console.error("Unexpected LlamaParse response format:", result);
    throw new Error("No content found in LlamaParse response");
  }
}

async function pollForResults(jobId: string): Promise<string> {
  const maxAttempts = 30; // 5 minutes with 10s intervals
  const statusUrl =
    `https://api.cloud.llamaindex.ai/api/v1/parsing/job/${jobId}`;
  const resultJsonUrl =
    `https://api.cloud.llamaindex.ai/api/v1/parsing/job/${jobId}/result`; // JSON with pages[]
  const resultMarkdownUrl =
    `https://api.cloud.llamaindex.ai/api/v1/parsing/job/${jobId}/result/markdown`;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`Polling attempt ${attempt}/${maxAttempts} for job ${jobId}`);

    const statusResponse = await fetch(statusUrl, {
      headers: { Authorization: `Bearer ${LLAMA_CLOUD_API_KEY}` },
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.warn(
        `Attempt ${attempt} failed to get job status: ${statusResponse.status}`,
        errorText,
      );
      await new Promise((resolve) => setTimeout(resolve, 10000));
      continue; // Try again on the next loop
    }

    const statusResult = await statusResponse.json();
    console.log("Current job status:", statusResult.status);

    if (statusResult.status === "SUCCESS") {
      // 1) Try JSON pages
      try {
        const r1 = await fetch(resultJsonUrl, {
          headers: {
            Authorization: `Bearer ${LLAMA_CLOUD_API_KEY}`,
            Accept: "application/json",
          },
        });
        if (r1.ok) {
          const json = await r1.json();
          if (Array.isArray(json.pages)) {
            console.log("Result: JSON pages length =", json.pages.length);
            const marked = json.pages
              .map((p: any, i: number) => {
                const pageNo = p.page ?? p.page_number ?? (i + 1);
                const text = p.text ?? p.markdown ?? "";
                return `--- page ${pageNo} ---\n${text}`;
              })
              .join("\n\n");
            return marked;
          }
          // Some responses may return { markdown}
          if (typeof json.markdown === "string") {
            console.log("Result: JSON markdown string");
            return json.markdown;
          }
        } else {
          console.warn("Result JSON fetch not OK:", r1.status, await r1.text());
        }
      } catch (e) {
        console.warn("Result JSON fetch failed:", e);
      }

      // 2) Fallback to markdown endpoint
      const r2 = await fetch(resultMarkdownUrl, {
        headers: {
          Authorization: `Bearer ${LLAMA_CLOUD_API_KEY}`,
          Accept: "application/json",
        },
      });
      if (!r2.ok) {
        const errorText = await r2.text();
        throw new Error(
          `Failed to fetch markdown result ${r2.status}: ${errorText}`,
        );
      }
      const resultData = await r2.json();
      if (typeof resultData.markdown !== "string") {
        throw new Error("Unexpected markdown result format.");
      }
      console.log(
        "Result: markdown string length =",
        resultData.markdown.length,
      );
      return resultData.markdown;
    }
    // If status is PENDING or IN_PROGRESS, wait 10 seconds before the next poll
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }

  throw new Error("Parsing timed out after 5 minutes.");
}

// CHANGED: accept pageCount and estimate page numbers when no markers exist
function chunkContent(content: string, pageCount?: number): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  const maxChunkSize = 1000;
  const overlap = 200;

  // Prefer explicit markers: --- page X ---
  const markerRegex = /---\s*page\s*(\d+)\s*---/i;
  const parts = content.split(markerRegex);

  // Branch A: markers present (split() with capturing group yields [text, num, text, num, text...])
  if (parts.length > 1) {
    console.log("Page markers detected. Parts:", parts.length);
    let currentPage = 1;
    let globalIndex = 0;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (!part) continue;

      if (/^\d+$/.test(part)) {
        currentPage = parseInt(part, 10);
        continue;
      }

      const sentences = part.split(/(?<=[.!?])\s+/);
      let currentChunk = "";
      let chunkStart = 0;

      for (const sentence of sentences) {
        if (
          currentChunk.length + sentence.length > maxChunkSize &&
          currentChunk.length > 0
        ) {
          chunks.push({
            content: currentChunk.trim(),
            pageNumber: currentPage,
            chunkIndex: globalIndex++,
            charStart: chunkStart,
            charEnd: chunkStart + currentChunk.length,
          });

          const words = currentChunk.split(" ");
          const overlapWords = words.slice(-Math.ceil(overlap / 5)).join(" ");
          currentChunk = overlapWords + " " + sentence;
          chunkStart += currentChunk.length - overlapWords.length -
            sentence.length - 1;
        } else {
          currentChunk += (currentChunk ? " " : "") + sentence;
        }
      }

      if (currentChunk.trim()) {
        chunks.push({
          content: currentChunk.trim(),
          pageNumber: currentPage,
          chunkIndex: globalIndex++,
          charStart: chunkStart,
          charEnd: chunkStart + currentChunk.length,
        });
      }
    }
  } else {
    const pages = Math.max(1, pageCount || 1);
    const avgCharsPerPage = Math.max(1000, Math.floor(content.length / pages));
    console.warn(
      `No page markers found. Estimating pages by length. pages=${pages}, avgCharsPerPage=${avgCharsPerPage}`,
    );

    const sentences = content.split(/(?<=[.!?])\s+/);
    let currentChunk = "";
    let globalIndex = 0;
    let globalCharPos = 0;
    let chunkStartGlobal = 0;

    for (const sentence of sentences) {
      if (
        currentChunk.length + sentence.length > maxChunkSize &&
        currentChunk.length > 0
      ) {
        // Estimate page from the start position of the chunk
        const estimatedPage = Math.min(
          pages,
          Math.floor(chunkStartGlobal / avgCharsPerPage) + 1,
        );

        chunks.push({
          content: currentChunk.trim(),
          pageNumber: estimatedPage,
          chunkIndex: globalIndex++,
          charStart: chunkStartGlobal,
          charEnd: chunkStartGlobal + currentChunk.length,
        });

        const words = currentChunk.split(" ");
        const overlapWords = words.slice(-Math.ceil(overlap / 5)).join(" ");
        currentChunk = overlapWords + " " + sentence;

        chunkStartGlobal = globalCharPos - overlapWords.length - 1;
        if (chunkStartGlobal < 0) chunkStartGlobal = 0;
      } else {
        currentChunk += (currentChunk ? " " : "") + sentence;
      }

      globalCharPos += sentence.length + 1; // approximate space/separator
    }

    if (currentChunk.trim()) {
      const estimatedPage = Math.min(
        pages,
        Math.floor(chunkStartGlobal / avgCharsPerPage) + 1,
      );

      chunks.push({
        content: currentChunk.trim(),
        pageNumber: estimatedPage,
        chunkIndex: globalIndex++,
        charStart: chunkStartGlobal,
        charEnd: chunkStartGlobal + currentChunk.length,
      });
    }
  }

  const dist = chunks.reduce<Record<number, number>>((a, c) => {
    a[c.pageNumber] = (a[c.pageNumber] || 0) + 1;
    return a;
  }, {});
  console.log("Chunk page distribution:", dist);

  return chunks;
}

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const model = "jina-embeddings-v2-base-en";
  const apiUrl = "https://api.jina.ai/v1/embeddings";

  const allEmbeddings: number[][] = [];

  const batchSize = 100;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batchTexts = texts.slice(i, i + batchSize);
    console.log(
      `Generating embeddings for batch ${Math.floor(i / batchSize) + 1}...`,
    );

    const payload = {
      input: batchTexts,
      model: model,
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${JINA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jina AI API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    const batchEmbeddings = result.data.map((item: any) => item.embedding);
    allEmbeddings.push(...batchEmbeddings);
  }

  console.log(`Successfully generated ${allEmbeddings.length} embeddings.`);
  return allEmbeddings;
}
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
