// ==========================================================================
// Edge Function: extract-metadata
// Purpose: Fetch course title, platform, description from a URL
// Primary: Mate.tools | Fallback: OpenUnfurl
// ==========================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": Deno.env.get("FRONTEND_URL") || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
    "Content-Type": "application/json",
};

interface MetadataResult {
    title: string;
    platform: string;
    description: string;
    source: string;
}

function extractPlatformFromUrl(url: string): string {
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        if (hostname.includes("coursera")) return "Coursera";
        if (hostname.includes("edx.org")) return "edX";
        if (hostname.includes("udemy")) return "Udemy";
        if (hostname.includes("khanacademy")) return "Khan Academy";
        if (hostname.includes("udacity")) return "Udacity";
        if (hostname.includes("futurelearn")) return "FutureLearn";
        if (hostname.includes("linkedin")) return "LinkedIn Learning";
        return "Other";
    } catch {
        return "Other";
    }
}

// ---- Mate.tools (Primary) ----
async function fetchFromMateTools(url: string): Promise<MetadataResult | null> {
    try {
        const response = await fetch("https://api.mate.tools/v1/url/info", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ url }),
            signal: AbortSignal.timeout(8000),
        });

        if (!response.ok) {
            console.error("Mate.tools error:", response.status);
            return null;
        }

        const data = await response.json();

        const title = data.title || data.ogTitle || data.pageTitle || "";
        const platform =
            data.siteName || data.ogSiteName || extractPlatformFromUrl(url);
        const description =
            data.description ||
            data.ogDescription ||
            data.metaDescription ||
            "";

        if (!title) return null;

        return {
            title: title.substring(0, 200),
            platform,
            description: description.substring(0, 2000),
            source: "mate.tools",
        };
    } catch (err) {
        console.error("Mate.tools request failed:", err);
        return null;
    }
}

// ---- OpenUnfurl (Fallback) ----
async function fetchFromOpenUnfurl(url: string): Promise<MetadataResult | null> {
    try {
        const apiUrl = `https://openunfurl.com/api/v1/metadata?url=${encodeURIComponent(url)}`;
        const response = await fetch(apiUrl, {
            method: "GET",
            signal: AbortSignal.timeout(8000),
        });

        if (!response.ok) {
            console.error("OpenUnfurl error:", response.status);
            return null;
        }

        const data = await response.json();

        const title = data.title || data.og_title || "";
        const platform =
            data.site_name || data.og_site_name || extractPlatformFromUrl(url);
        const description =
            data.description || data.og_description || "";

        if (!title) return null;

        return {
            title: title.substring(0, 200),
            platform,
            description: description.substring(0, 2000),
            source: "openunfurl",
        };
    } catch (err) {
        console.error("OpenUnfurl request failed:", err);
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

        const body = await req.json();
        const url = (body.url || "").trim();

        if (!url || !url.match(/^https?:\/\//i)) {
            return new Response(
                JSON.stringify({
                    error: true,
                    message: "A valid URL starting with http:// or https:// is required",
                    code: "VALIDATION_ERROR",
                    field: "url",
                }),
                { status: 400, headers: CORS_HEADERS }
            );
        }

        // Try Mate.tools first
        let result = await fetchFromMateTools(url);

        // Fallback to OpenUnfurl
        if (!result) {
            result = await fetchFromOpenUnfurl(url);
        }

        // Both failed
        if (!result) {
            return new Response(
                JSON.stringify({
                    error: true,
                    message:
                        "Could not fetch metadata from this URL. Please enter the course details manually.",
                    code: "METADATA_FETCH_FAILED",
                }),
                { status: 502, headers: CORS_HEADERS }
            );
        }

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: CORS_HEADERS,
        });
    } catch (err) {
        console.error("extract-metadata error:", err);
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
