// ==========================================================================
// Edge Function: generate-embedding
// Purpose: Generate 768-dim vector using Gemini embedding-001
// ==========================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": Deno.env.get("FRONTEND_URL") || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
    "Content-Type": "application/json",
};

const EMBEDDING_MODEL = "embedding-001";
const EMBEDDING_DIM = 768;

interface EmbeddingInput {
    course_id: string;
    title: string;
    description?: string;
    category?: string;
}

function buildEmbeddingText(
    title: string,
    description: string,
    category: string
): string {
    const parts = [title];
    if (category) parts.push(category);
    if (description) parts.push(description);
    return parts.join(" — ");
}

async function generateEmbedding(text: string): Promise<number[] | null> {
    if (!GEMINI_API_KEY) return null;

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: `models/${EMBEDDING_MODEL}`,
                content: {
                    parts: [{ text }],
                },
                outputDimensionality: EMBEDDING_DIM,
            }),
        });

        if (!response.ok) {
            console.error(
                "Gemini embedding error:",
                response.status,
                await response.text()
            );
            return null;
        }

        const data = await response.json();
        const values = data.embedding?.values;
        if (!values || !Array.isArray(values)) {
            console.error("No embedding values in response");
            return null;
        }

        return values;
    } catch (err) {
        console.error("Embedding request failed:", err);
        return null;
    }
}

// ---- Main Handler ----
serve(async (req: Request) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (req.method !== "POST") {
        return new Response(
            JSON.stringify({
                error: true,
                message: "Method not allowed",
                code: "METHOD_NOT_ALLOWED",
            }),
            { status: 405, headers: CORS_HEADERS }
        );
    }

    try {
        // Verify authentication
        const authHeader = req.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return new Response(
                JSON.stringify({
                    error: true,
                    message: "Missing or invalid authorization",
                    code: "UNAUTHORIZED",
                }),
                { status: 401, headers: CORS_HEADERS }
            );
        }

        const body: EmbeddingInput = await req.json();
        const courseId = (body.course_id || "").trim();
        const title = (body.title || "").trim();
        const description = (body.description || "").trim();
        const category = (body.category || "").trim();

        if (!courseId) {
            return new Response(
                JSON.stringify({
                    error: true,
                    message: "course_id is required",
                    code: "VALIDATION_ERROR",
                    field: "course_id",
                }),
                { status: 400, headers: CORS_HEADERS }
            );
        }

        if (!title) {
            return new Response(
                JSON.stringify({
                    error: true,
                    message: "title is required",
                    code: "VALIDATION_ERROR",
                    field: "title",
                }),
                { status: 400, headers: CORS_HEADERS }
            );
        }

        // Build text for embedding
        const embeddingText = buildEmbeddingText(title, description, category);

        // Generate embedding
        const vector = await generateEmbedding(embeddingText);

        if (!vector) {
            return new Response(
                JSON.stringify({
                    error: true,
                    message: "Failed to generate embedding. Course saved without vector.",
                    code: "AI_SERVICE_UNAVAILABLE",
                }),
                { status: 503, headers: CORS_HEADERS }
            );
        }

        // Store in database
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false },
        });

        const { error: updateError } = await supabase
            .from("courses")
            .update({ embedding: JSON.stringify(vector) })
            .eq("id", courseId);

        if (updateError) {
            console.error("Database update error:", updateError);
            return new Response(
                JSON.stringify({
                    error: true,
                    message: "Failed to store embedding in database",
                    code: "INTERNAL_ERROR",
                }),
                { status: 500, headers: CORS_HEADERS }
            );
        }

        return new Response(
            JSON.stringify({
                status: "ok",
                dimensions: EMBEDDING_DIM,
                course_id: courseId,
            }),
            { status: 200, headers: CORS_HEADERS }
        );
    } catch (err) {
        console.error("generate-embedding error:", err);
        return new Response(
            JSON.stringify({
                error: true,
                message: "Internal server error",
                code: "INTERNAL_ERROR",
            }),
            { status: 500, headers: CORS_HEADERS }
        );
    }
});
