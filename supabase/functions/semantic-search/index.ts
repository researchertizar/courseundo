// ==========================================================================
// Edge Function: semantic-search
// Purpose: Find courses by semantic similarity using pgvector
// ==========================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": Deno.env.get("FRONTEND_URL") || "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, Prefer, x-client-info, x-supabase-auth",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
};

const EMBEDDING_MODEL = "embedding-001";
const EMBEDDING_DIM = 768;

interface SearchInput {
    query: string;
    limit?: number;
}

async function generateQueryEmbedding(query: string): Promise<number[] | null> {
    if (!GEMINI_API_KEY) return null;

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: `models/${EMBEDDING_MODEL}`,
                content: {
                    parts: [{ text: query }],
                },
                outputDimensionality: EMBEDDING_DIM,
            }),
        });

        if (!response.ok) {
            console.error("Gemini embedding error:", response.status);
            return null;
        }

        const data = await response.json();
        return data.embedding?.values || null;
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
        const body: SearchInput = await req.json();
        const query = (body.query || "").trim();
        const limit = Math.min(Math.max(body.limit || 20, 1), 100);

        if (!query || query.length < 2) {
            return new Response(
                JSON.stringify({
                    error: true,
                    message: "Query must be at least 2 characters",
                    code: "VALIDATION_ERROR",
                    field: "query",
                }),
                { status: 400, headers: CORS_HEADERS }
            );
        }

        // Generate query embedding
        const queryVector = await generateQueryEmbedding(query);

        if (!queryVector) {
            // Fallback: return empty with fallback signal
            return new Response(
                JSON.stringify({
                    results: [],
                    fallback: "keyword_search",
                    reason:
                        "Vector search unavailable, returned keyword matches",
                    total_results: 0,
                }),
                { status: 200, headers: CORS_HEADERS }
            );
        }

        // Initialize Supabase client
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false },
        });

        // Query with pgvector cosine similarity
        const { data: results, error } = await supabase.rpc("match_courses", {
            query_embedding: JSON.stringify(queryVector),
            match_count: limit,
            similarity_threshold: 0.3,
        });

        if (error) {
            // If the RPC doesn't exist, fall back to raw SQL via REST
            console.warn("RPC match_courses not found, using raw query");

            const vectorStr = `[${queryVector.join(",")}]`;
            const { data: rawResults, error: rawError } = await supabase
                .from("courses")
                .select("*")
                .eq("status", "active")
                .not("embedding", "is", null)
                .limit(limit);

            if (rawError) {
                console.error("Raw query error:", rawError);
                return new Response(
                    JSON.stringify({
                        results: [],
                        fallback: "keyword_search",
                        reason: "Database query failed",
                        total_results: 0,
                    }),
                    { status: 200, headers: CORS_HEADERS }
                );
            }

            // Calculate similarity in-memory (less efficient but works)
            const coursesWithSimilarity = (rawResults || [])
                .map((course: any) => {
                    let similarity = 0;
                    if (course.embedding && Array.isArray(course.embedding)) {
                        similarity = cosineSimilarity(queryVector, course.embedding);
                    }
                    return { ...course, similarity };
                })
                .filter((c) => c.similarity >= 0.3)
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, limit);

            // Remove embedding from response to reduce payload
            const cleaned = coursesWithSimilarity.map((c) => {
                const { embedding, ...rest } = c;
                return rest;
            });

            return new Response(
                JSON.stringify({
                    results: cleaned,
                    query_embedding_generated: true,
                    total_results: cleaned.length,
                }),
                { status: 200, headers: CORS_HEADERS }
            );
        }

        // RPC succeeded
        const cleaned = (results || []).map((c: any) => {
            const { embedding, ...rest } = c;
            return rest;
        });

        return new Response(
            JSON.stringify({
                results: cleaned,
                query_embedding_generated: true,
                total_results: cleaned.length,
            }),
            { status: 200, headers: CORS_HEADERS }
        );
    } catch (err) {
        console.error("semantic-search error:", err);
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

// ---- Cosine Similarity Helper ----
function cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
}
