// ==========================================================================
// Edge Function: extract-metadata (FIXED)
// Purpose: Fetch course title, platform, description from a URL
// Primary: Mate.tools | Fallback: OpenUnfurl | Last resort: URL parsing
// ==========================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": Deno.env.get("FRONTEND_URL") || "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, Prefer, x-client-info",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
};

function extractPlatformFromUrl(url: string): string {
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        if (hostname.includes("coursera")) return "Coursera";
        if (hostname.includes("edx.org") || hostname.includes("edx")) return "edX";
        if (hostname.includes("udemy")) return "Udemy";
        if (hostname.includes("khanacademy") || hostname.includes("khan")) return "Khan Academy";
        if (hostname.includes("udacity")) return "Udacity";
        if (hostname.includes("futurelearn")) return "FutureLearn";
        if (hostname.includes("linkedin")) return "LinkedIn Learning";
        if (hostname.includes("codecademy")) return "Codecademy";
        if (hostname.includes("freecodecamp")) return "freeCodeCamp";
        if (hostname.includes("pluralsight")) return "Pluralsight";
        if (hostname.includes("skillshare")) return "Skillshare";
        if (hostname.includes("datacamp")) return "DataCamp";
        if (hostname.includes("google.com/learn") || hostname.includes("cloud.google.com/learn")) return "Google Cloud";
        if (hostname.includes("aws.training") || hostname.includes("aws.amazon.com/training")) return "AWS";
        if (hostname.includes("microsoft.com/learn")) return "Microsoft Learn";
        return "Other";
    } catch {
        return "Other";
    }
}

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
    return new Promise((resolve, reject) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
            reject(new Error(`Request timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        fetch(url, { ...options, signal: controller.signal })
            .then((response) => {
                clearTimeout(timeoutId);
                resolve(response);
            })
            .catch((err) => {
                clearTimeout(timeoutId);
                reject(err);
            });
    });
}

// ---- Mate.tools (Primary) ----
async function fetchFromMateTools(url: string): Promise<any | null> {
    try {
        console.log("[extract-metadata] Trying Mate.tools for:", url);

        const response = await fetchWithTimeout(
            "https://api.mate.tools/v1/url/info",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
            },
            8000
        );

        console.log("[extract-metadata] Mate.tools status:", response.status);

        if (!response.ok) {
            console.warn("[extract-metadata] Mate.tools failed with status:", response.status);
            return null;
        }

        const data = await response.json();
        console.log("[extract-metadata] Mate.tools response keys:", Object.keys(data));

        const title = data.title || data.ogTitle || data.pageTitle || data.metaTitle || "";
        const siteName = data.siteName || data.ogSiteName || "";
        const description = data.description || data.ogDescription || data.metaDescription || "";

        if (!title && !siteName) {
            console.warn("[extract-metadata] Mate.tools returned no useful data");
            return null;
        }

        return {
            title: (title || "").substring(0, 200),
            platform: siteName || extractPlatformFromUrl(url),
            description: (description || "").substring(0, 2000),
            source: "mate.tools",
        };
    } catch (err) {
        console.error("[extract-metadata] Mate.tools error:", err.message || err);
        return null;
    }
}

// ---- OpenUnfurl (Fallback) ----
async function fetchFromOpenUnfurl(url: string): Promise<any | null> {
    try {
        console.log("[extract-metadata] Trying OpenUnfurl for:", url);

        const apiUrl = `https://openunfurl.com/api/v1/metadata?url=${encodeURIComponent(url)}`;

        const response = await fetchWithTimeout(
            apiUrl,
            { method: "GET" },
            8000
        );

        console.log("[extract-metadata] OpenUnfurl status:", response.status);

        if (!response.ok) {
            console.warn("[extract-metadata] OpenUnfurl failed with status:", response.status);
            return null;
        }

        const data = await response.json();
        console.log("[extract-metadata] OpenUnfurl response keys:", Object.keys(data));

        const title = data.title || data.og_title || "";
        const siteName = data.site_name || data.og_site_name || "";
        const description = data.description || data.og_description || "";

        if (!title && !siteName) {
            console.warn("[extract-metadata] OpenUnfurl returned no useful data");
            return null;
        }

        return {
            title: (title || "").substring(0, 200),
            platform: siteName || extractPlatformFromUrl(url),
            description: (description || "").substring(0, 2000),
            source: "openunfurl",
        };
    } catch (err) {
        console.error("[extract-metadata] OpenUnfurl error:", err.message || err);
        return null;
    }
}

// ---- Direct HTML Fetch (Last Resort) ----
async function fetchDirectFromUrl(url: string): Promise<any | null> {
    try {
        console.log("[extract-metadata] Trying direct fetch for:", url);

        const response = await fetchWithTimeout(
            url,
            {
                method: "GET",
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; CourseundoBot/1.0)",
                    "Accept": "text/html",
                },
            },
            8000
        );

        console.log("[extract-metadata] Direct fetch status:", response.status);

        if (!response.ok) {
            console.warn("[extract-metadata] Direct fetch failed:", response.status);
            return null;
        }

        const html = await response.text();

        // Extract title from <title> tag
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
        const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
        const ogDescMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
        const siteNameMatch = html.match(/<meta\s+property="og:site_name"\s+content="([^"]+)"/i);

        const title = ogTitleMatch?.[1] || titleMatch?.[1] || "";
        const siteName = siteNameMatch?.[1] || "";
        const description = ogDescMatch?.[1] || descMatch?.[1] || "";

        if (!title && !siteName) {
            console.warn("[extract-metadata] Direct fetch found no metadata in HTML");
            return null;
        }

        return {
            title: (title || "").substring(0, 200).trim(),
            platform: siteName ? siteName.trim() : extractPlatformFromUrl(url),
            description: (description || "").substring(0, 2000).trim(),
            source: "direct_html",
        };
    } catch (err) {
        console.error("[extract-metadata] Direct fetch error:", err.message || err);
        return null;
    }
}

// ---- Main Handler ----
serve(async (req: Request) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
        console.log("[extract-metadata] CORS preflight received");
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
        console.log("[extract-metadata] Request received");

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

        const url = (body.url || "").trim();
        console.log("[extract-metadata] URL:", url);

        if (!url) {
            return new Response(
                JSON.stringify({
                    error: true,
                    message: "URL is required",
                    code: "VALIDATION_ERROR",
                    field: "url",
                }),
                { status: 400, headers: CORS_HEADERS }
            );
        }

        if (!url.match(/^https?:\/\/.+/i)) {
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

        // Try all three sources in order
        let result = await fetchFromMateTools(url);

        if (!result) {
            console.log("[extract-metadata] Mate.tools failed, trying OpenUnfurl...");
            result = await fetchFromOpenUnfurl(url);
        }

        if (!result) {
            console.log("[extract-metadata] OpenUnfurl failed, trying direct HTML fetch...");
            result = await fetchFromDirectUrl(url);
        }

        // If all three failed, return platform guess from URL at minimum
        if (!result) {
            console.log("[extract-metadata] All sources failed, returning URL-based guess");
            return new Response(
                JSON.stringify({
                    title: "",
                    platform: extractPlatformFromUrl(url),
                    description: "",
                    source: "url_guess",
                    warning: "Could not fetch metadata. Please enter details manually.",
                }),
                { status: 200, headers: CORS_HEADERS }
            );
        }

        console.log("[extract-metadata] Success:", result);
        return new Response(JSON.stringify(result), {
            status: 200,
            headers: CORS_HEADERS,
        });
    } catch (err) {
        console.error("[extract-metadata] Unhandled error:", err);
        return new Response(
            JSON.stringify({
                error: true,
                message: `Internal server error: ${err.message || String(err)}`,
                code: "INTERNAL_ERROR",
            }),
            { status: 500, headers: CORS_HEADERS }
        );
    }
});
