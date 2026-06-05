// ==========================================================================
// Edge Function: classify-course
// Purpose: AI-powered course classification using Groq (primary) + Gemini (fallback)
// ==========================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": Deno.env.get("FRONTEND_URL") || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
    "Content-Type": "application/json",
};

interface ClassifyInput {
    title: string;
    description?: string;
}

interface ClassifyResult {
    category: string;
    difficulty: string;
    duration: string;
    job_relevance: string;
    model_used: string;
}

const ALLOWED_CATEGORIES = [
    "Programming", "Data Science", "AI/ML", "Business",
    "Design", "Language", "Math", "Science", "Other",
];

const ALLOWED_DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];

function buildPrompt(title: string, description: string): string {
    return `Classify this online course. Return ONLY valid JSON with no additional text, markdown, or code fences.

Title: ${title}
Description: ${description || "No description provided."}

Return JSON with exactly these keys:
{
  "category": "one of: Programming, Data Science, AI/ML, Business, Design, Language, Math, Science, Other",
  "difficulty": "one of: Beginner, Intermediate, Advanced",
  "duration": "estimated duration string, e.g. '30-40 hours' or '6 weeks'",
  "job_relevance": "one of: High, Medium, Low, None"
}`;
}

function validateResult(data: any): ClassifyResult {
    let category = data.category || "Other";
    let difficulty = data.difficulty || "Beginner";

    // Normalize category
    const catLower = category.toLowerCase();
    const matchedCat = ALLOWED_CATEGORIES.find(
        (c) => c.toLowerCase() === catLower
    );
    category = matchedCat || "Other";

    // Normalize difficulty
    const diffLower = difficulty.toLowerCase();
    const matchedDiff = ALLOWED_DIFFICULTIES.find(
        (d) => d.toLowerCase() === diffLower
    );
    difficulty = matchedDiff || "Beginner";

    const duration = typeof data.duration === "string" ? data.duration : "Unknown";
    const jobRelevance = data.job_relevance || "None";

    return {
        category,
        difficulty,
        duration,
        job_relevance: jobRelevance,
        model_used: data.model_used || "unknown",
    };
}

// ---- Groq (Primary) ----
async function classifyWithGroq(
    title: string,
    description: string
): Promise<ClassifyResult | null> {
    if (!GROQ_API_KEY) return null;

    try {
        const response = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${GROQ_API_KEY}`,
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        {
                            role: "user",
                            content: buildPrompt(title, description),
                        },
                    ],
                    temperature: 0.3,
                    max_tokens: 300,
                    response_format: { type: "json_object" },
                }),
            }
        );

        if (!response.ok) {
            console.error("Groq API error:", response.status, await response.text());
            return null;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) return null;

        // Parse JSON from the response (handle possible markdown fences)
        let parsed: any;
        try {
            const cleaned = content
                .replace(/```json\s*/g, "")
                .replace(/```\s*/g, "")
                .trim();
            parsed = JSON.parse(cleaned);
        } catch {
            console.error("Failed to parse Groq response as JSON:", content);
            return null;
        }

        parsed.model_used = "groq";
        return validateResult(parsed);
    } catch (err) {
        console.error("Groq request failed:", err);
        return null;
    }
}

// ---- Gemini (Fallback) ----
async function classifyWithGemini(
    title: string,
    description: string
): Promise<ClassifyResult | null> {
    if (!GEMINI_API_KEY) return null;

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{ text: buildPrompt(title, description) }],
                    },
                ],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 300,
                    responseMimeType: "application/json",
                },
            }),
        });

        if (!response.ok) {
            console.error(
                "Gemini API error:",
                response.status,
                await response.text()
            );
            return null;
        }

        const data = await response.json();
        const content =
            data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!content) return null;

        let parsed: any;
        try {
            const cleaned = content
                .replace(/```json\s*/g, "")
                .replace(/```\s*/g, "")
                .trim();
            parsed = JSON.parse(cleaned);
        } catch {
            console.error("Failed to parse Gemini response as JSON:", content);
            return null;
        }

        parsed.model_used = "gemini";
        return validateResult(parsed);
    } catch (err) {
        console.error("Gemini request failed:", err);
        return null;
    }
}

// ---- Main Handler ----
serve(async (req: Request) => {
    // Handle CORS preflight
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

        const body: ClassifyInput = await req.json();
        const title = (body.title || "").trim();
        const description = (body.description || "").trim();

        if (!title || title.length < 3) {
            return new Response(
                JSON.stringify({
                    error: true,
                    message: "Title is required and must be at least 3 characters",
                    code: "VALIDATION_ERROR",
                    field: "title",
                }),
                { status: 400, headers: CORS_HEADERS }
            );
        }

        // Try Groq first
        let result = await classifyWithGroq(title, description);

        // Fallback to Gemini
        if (!result) {
            result = await classifyWithGemini(title, description);
        }

        // Both failed
        if (!result) {
            return new Response(
                JSON.stringify({
                    error: true,
                    message:
                        "AI classification unavailable. Please fill in the fields manually.",
                    code: "AI_SERVICE_UNAVAILABLE",
                }),
                { status: 503, headers: CORS_HEADERS }
            );
        }

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: CORS_HEADERS,
        });
    } catch (err) {
        console.error("classify-course error:", err);
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
