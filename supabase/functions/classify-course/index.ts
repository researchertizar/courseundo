// supabase/functions/classify-course/index.ts
// FIXED VERSION with better error handling and logging

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": Deno.env.get("FRONTEND_URL") || "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, Prefer, x-client-info",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};


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

function normalizeResult(data: any, modelUsed: string) {
    let category = data.category || "Other";
    let difficulty = data.difficulty || "Beginner";

    const matchedCat = ALLOWED_CATEGORIES.find(
        (c) => c.toLowerCase() === category.toLowerCase()
    );
    category = matchedCat || "Other";

    const matchedDiff = ALLOWED_DIFFICULTIES.find(
        (d) => d.toLowerCase() === difficulty.toLowerCase()
    );
    difficulty = matchedDiff || "Beginner";

    return {
        category,
        difficulty,
        duration: typeof data.duration === "string" ? data.duration : "Unknown",
        job_relevance: data.job_relevance || "None",
        model_used: modelUsed,
    };
}

// ---- Groq (Primary) ----
async function classifyWithGroq(
    title: string,
    description: string
): Promise<any | null> {
    const apiKey = Deno.env.get("GROQ_API_KEY");
    console.log("[classify-course] GROQ_API_KEY present:", !!apiKey);

    if (!apiKey) {
        console.warn("[classify-course] GROQ_API_KEY is not set");
        return null;
    }

    try {
        console.log("[classify-course] Calling Groq API...");
        const response = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
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
                }),
            }
        );

        console.log("[classify-course] Groq response status:", response.status);

        if (!response.ok) {
            const errText = await response.text();
            console.error("[classify-course] Groq API error:", response.status, errText);
            return null;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            console.error("[classify-course] Groq returned empty content");
            return null;
        }

        console.log("[classify-course] Groq raw content:", content);

        // Parse JSON — handle markdown code fences
        const cleaned = content
            .replace(/```json\s*/g, "")
            .replace(/```\s*/g, "")
            .trim();

        const parsed = JSON.parse(cleaned);
        console.log("[classify-course] Groq parsed result:", parsed);
        return normalizeResult(parsed, "groq");
    } catch (err) {
        console.error("[classify-course] Groq request failed:", err);
        return null;
    }
}

// ---- Gemini (Fallback) ----
async function classifyWithGemini(
    title: string,
    description: string
): Promise<any | null> {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    console.log("[classify-course] GEMINI_API_KEY present:", !!apiKey);

    if (!apiKey) {
        console.warn("[classify-course] GEMINI_API_KEY is not set");
        return null;
    }

    try {
        console.log("[classify-course] Calling Gemini API...");
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

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

        console.log("[classify-course] Gemini response status:", response.status);

        if (!response.ok) {
            const errText = await response.text();
            console.error("[classify-course] Gemini API error:", response.status, errText);
            return null;
        }

        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!content) {
            console.error("[classify-course] Gemini returned empty content");
            return null;
        }

        console.log("[classify-course] Gemini raw content:", content);

        const cleaned = content
            .replace(/```json\s*/g, "")
            .replace(/```\s*/g, "")
            .trim();

        const parsed = JSON.parse(cleaned);
        console.log("[classify-course] Gemini parsed result:", parsed);
        return normalizeResult(parsed, "gemini");
    } catch (err) {
        console.error("[classify-course] Gemini request failed:", err);
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
                message: "Method not allowed. Use POST.",
                code: "METHOD_NOT_ALLOWED",
            }),
            { status: 405, headers: CORS_HEADERS }
        );
    }

    try {
        console.log("[classify-course] Request received");

        // Parse body
        let body: any;
        try {
            body = await req.json();
        } catch {
            return new Response(
                JSON.stringify({
                    error: true,
                    message: "Invalid JSON in request body",
                    code: "VALIDATION_ERROR",
                }),
                { status: 400, headers: CORS_HEADERS }
            );
        }

        const title = (body.title || "").trim();
        const description = (body.description || "").trim();

        console.log("[classify-course] Input:", { title, descriptionLength: description.length });

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
            console.log("[classify-course] Groq failed or unavailable, trying Gemini...");
            result = await classifyWithGemini(title, description);
        }

        // Both failed
        if (!result) {
            console.error("[classify-course] Both Groq and Gemini failed");
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

        console.log("[classify-course] Success:", result);
        return new Response(JSON.stringify(result), {
            status: 200,
            headers: CORS_HEADERS,
        });
    } catch (err) {
        console.error("[classify-course] Unhandled error:", err);
        return new Response(
            JSON.stringify({
                error: true,
                message: `Internal server error: ${err.message || err}`,
                code: "INTERNAL_ERROR",
            }),
            { status: 500, headers: CORS_HEADERS }
        );
    }
});
