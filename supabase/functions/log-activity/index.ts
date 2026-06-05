// ==========================================================================
// Edge Function: log-activity
// Purpose: Record user actions in activity_log table
// ==========================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": Deno.env.get("FRONTEND_URL") || "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, Prefer, x-client-info",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};


interface ActivityInput {
    action: string;
    details?: Record<string, any>;
    ip_address?: string;
    ip_country?: string;
    ip_city?: string;
    device_type?: string;
    browser?: string;
    os?: string;
    screen_size?: string;
    referrer?: string;
    session_id?: string;
}

// ---- Device Detection from User-Agent ----
function parseUserAgent(ua: string): {
    device_type: string;
    browser: string;
    os: string;
} {
    if (!ua) return { device_type: "Unknown", browser: "Unknown", os: "Unknown" };

    let device_type = "Desktop";
    if (/Mobile|Android|iPhone|iPad/i.test(ua)) {
        device_type = /iPad|Tablet/i.test(ua) ? "Tablet" : "Mobile";
    }

    let browser = "Unknown";
    if (/Edg\//i.test(ua)) browser = "Edge";
    else if (/Chrome/i.test(ua)) browser = "Chrome";
    else if (/Firefox/i.test(ua)) browser = "Firefox";
    else if (/Safari/i.test(ua)) browser = "Safari";
    else if (/Opera|OPR/i.test(ua)) browser = "Opera";

    let os = "Unknown";
    if (/Windows/i.test(ua)) os = "Windows";
    else if (/Mac OS/i.test(ua)) os = "macOS";
    else if (/iPhone|iPad/i.test(ua)) os = "iOS";
    else if (/Android/i.test(ua)) os = "Android";
    else if (/Linux/i.test(ua)) os = "Linux";

    return { device_type, browser, os };
}

// ---- IP Geolocation (using free API) ----
async function geolocateIP(ip: string): Promise<{
    ip_country: string;
    ip_city: string;
}> {
    if (
        !ip ||
        ip === "127.0.0.1" ||
        ip === "::1" ||
        ip.startsWith("192.168.") ||
        ip.startsWith("10.")
    ) {
        return { ip_country: "Local", ip_city: "Local" };
    }

    try {
        const resp = await fetch(`http://ip-api.com/json/${ip}?fields=country,city`, {
            signal: AbortSignal.timeout(3000),
        });
        if (!resp.ok) return { ip_country: "Unknown", ip_city: "Unknown" };
        const data = await resp.json();
        return {
            ip_country: data.country || "Unknown",
            ip_city: data.city || "Unknown",
        };
    } catch {
        return { ip_country: "Unknown", ip_city: "Unknown" };
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
        const body: ActivityInput = await req.json();

        if (!body.action) {
            return new Response(
                JSON.stringify({
                    error: true,
                    message: "action is required",
                    code: "VALIDATION_ERROR",
                }),
                { status: 400, headers: CORS_HEADERS }
            );
        }

        // Extract IP from request headers
        const clientIP =
            req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            req.headers.get("x-real-ip") ||
            body.ip_address ||
            "Unknown";

        // Parse User-Agent
        const userAgent = req.headers.get("user-agent") || "";
        const parsed = parseUserAgent(userAgent);

        // Geolocate IP (async, non-blocking with timeout)
        let geo = { ip_country: "Unknown", ip_city: "Unknown" };
        try {
            geo = await geolocateIP(clientIP);
        } catch {
            // Ignore geolocation failures
        }

        // Build the log entry
        const logEntry = {
            action: body.action,
            details: body.details || {},
            ip_address: clientIP,
            ip_country: body.ip_country || geo.ip_country,
            ip_city: body.ip_city || geo.ip_city,
            device_type: body.device_type || parsed.device_type,
            browser: body.browser || parsed.browser,
            os: body.os || parsed.os,
            screen_size: body.screen_size || null,
            referrer: body.referrer || req.headers.get("referer") || null,
            session_id: body.session_id || null,
        };

        // Insert into database
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false },
        });

        const { data: inserted, error } = await supabase
            .from("activity_log")
            .insert(logEntry)
            .select("id")
            .single();

        if (error) {
            console.error("Activity log insert error:", error);
            return new Response(
                JSON.stringify({
                    error: true,
                    message: "Failed to log activity",
                    code: "INTERNAL_ERROR",
                }),
                { status: 500, headers: CORS_HEADERS }
            );
        }

        // Trigger notification for suggestion and rating actions
        if (
            body.action === "suggestion" ||
            body.action === "new_suggestion"
        ) {
            try {
                await supabase.functions.invoke("send-notification", {
                    body: {
                        type: "new_suggestion",
                        data: {
                            ...(body.details || {}),
                            ip_address: clientIP,
                            device_type: logEntry.device_type,
                            browser: logEntry.browser,
                            ip_country: logEntry.ip_country,
                            created_at: new Date().toISOString(),
                        },
                    },
                });
            } catch (notifErr) {
                console.warn("Notification trigger failed (non-critical):", notifErr);
            }
        }

        if (body.action === "rating" || body.action === "new_rating") {
            try {
                await supabase.functions.invoke("send-notification", {
                    body: {
                        type: "new_rating",
                        data: {
                            ...(body.details || {}),
                            ip_address: clientIP,
                            device_type: logEntry.device_type,
                        },
                    },
                });
            } catch (notifErr) {
                console.warn("Notification trigger failed (non-critical):", notifErr);
            }
        }

        return new Response(
            JSON.stringify({
                logged: true,
                id: inserted?.id,
            }),
            { status: 200, headers: CORS_HEADERS }
        );
    } catch (err) {
        console.error("log-activity error:", err);
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
