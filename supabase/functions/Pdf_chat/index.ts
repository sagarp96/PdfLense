import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JINA_API_KEY = Deno.env.get("JINA_API_KEY")!;
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req: Request): Promise<Response> => {
  console.log("=== PDF Chat Function Called ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);

  if (req.method === "OPTIONS") {
    console.log("Handling CORS preflight");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("Parsing request body...");
    const body = await req.json();
    console.log("Request body:", JSON.stringify(body, null, 2));

    const { message, document_id, session_id } = body;

    if (!message || !document_id) {
      console.log("Missing required fields:", {
        message: !!message,
        document_id: !!document_id,
      });
      return jsonResponse(
        { error: "message and document_id are required" },
        400,
      );
    }

    console.log("Processing chat request for document:", document_id);

    // 1. Create or get chat session
    let chatSessionId = session_id;
    if (!chatSessionId) {
      console.log("Creating new chat session...");
      const { data: newSession, error: sessionError } = await supabase
        .from("chat_sessions")
        .insert({
          document_id,
          title: message.slice(0, 50) + (message.length > 50 ? "..." : ""),
        })
        .select()
        .single();

      if (sessionError) {
        console.error("Session creation error:", sessionError);
        throw sessionError;
      }
      chatSessionId = newSession.id;
      console.log("Created new session:", chatSessionId);
    } else {
      console.log("Using existing session:", chatSessionId);
    }

    // 2. Store user message
    console.log("Storing user message...");
    const { error: userMessageError } = await supabase
      .from("chat_messages")
      .insert({
        session_id: chatSessionId,
        role: "user",
        content: message,
      });

    if (userMessageError) {
      console.error("User message storage error:", userMessageError);
      throw userMessageError;
    }
    console.log("User message stored successfully");

    // 3. Generate embedding for user message
    console.log("Generating embedding for query...");
    const queryEmbedding = await generateEmbedding(message);
    console.log("Embedding generated, length:", queryEmbedding.length);

    // 4. Search for relevant chunks
    console.log("Searching for relevant document chunks...");
    const { data: relevantChunks, error: searchError } = await supabase
      .rpc("match_documents", {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: 5,
        doc_id: document_id,
      });

    if (searchError) {
      console.error("Document search error:", searchError);
      return jsonResponse({ error: "Failed to search document" }, 500);
    }

    console.log("Found relevant chunks:", relevantChunks?.length || 0);

    if (!relevantChunks || relevantChunks.length === 0) {
      console.log("No relevant chunks found, returning default response");
      const noResultsResponse =
        "I couldn't find relevant information in the document to answer your question. Please try rephrasing your question or ask about different topics covered in the document.";

      const { data: assistantMessage } = await supabase
        .from("chat_messages")
        .insert({
          session_id: chatSessionId,
          role: "assistant",
          content: noResultsResponse,
          citations: [],
        })
        .select()
        .single();

      return jsonResponse({
        response: noResultsResponse,
        citations: [],
        session_id: chatSessionId,
        message_id: assistantMessage?.id,
      });
    }

    // 5. Create context and citations
    console.log("Creating context from chunks...");
    const context = relevantChunks
      .map((chunk: any) => `[Page ${chunk.page_number}] ${chunk.content}`)
      .join("\n\n");

    const citations = relevantChunks.map((chunk: any) => ({
      page: chunk.page_number,
      content: chunk.content.slice(0, 100) + "...",
      similarity: chunk.similarity,
    }));

    console.log("Context created, citations:", citations.length);

    // 6. Generate AI response
    console.log("Generating AI response...");
    const aiResponse = await generateResponse(message, context);
    console.log("AI response generated successfully");

    // 7. Store AI response with citations
    console.log("Storing assistant message...");
    const { data: assistantMessage, error: assistantError } = await supabase
      .from("chat_messages")
      .insert({
        session_id: chatSessionId,
        role: "assistant",
        content: aiResponse,
        citations: citations,
      })
      .select()
      .single();

    if (assistantError) {
      console.error("Assistant message storage error:", assistantError);
      throw assistantError;
    }

    console.log("Chat processing completed successfully");

    return jsonResponse({
      response: aiResponse,
      citations: citations,
      session_id: chatSessionId,
      message_id: assistantMessage.id,
    });
  } catch (error) {
    console.error("=== CHAT ERROR ===");
    console.error("Error details:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    return jsonResponse({
      error: error.message || "Internal server error",
      details: error.stack,
    }, 500);
  }
});

async function generateEmbedding(text: string): Promise<number[]> {
  console.log("Calling Jina API for embedding generation...");

  const response = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${JINA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: [text],
      model: "jina-embeddings-v2-base-en",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Jina API error:", response.status, errorText);
    throw new Error(
      `Embedding generation failed: ${response.status} - ${errorText}`,
    );
  }

  const result = await response.json();
  console.log("Jina API response received");
  return result.data[0].embedding;
}

async function generateResponse(
  query: string,
  context: string,
): Promise<string> {
  console.log("Calling Groq API for response generation...");

  const systemPrompt =
    `You are a helpful AI assistant that answers questions about PDF documents. 
Use the provided context to answer the user's question accurately and concisely. 
If the answer isn't in the context, say so. Always cite page numbers when referencing information.

Context from the document:
${context}`;

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Groq API error:", response.status, errorText);
    throw new Error(`Groq API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log("Groq API response received");
  return result.choices[0].message.content;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
