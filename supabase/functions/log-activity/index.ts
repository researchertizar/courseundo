import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req: Request) => {
    const origin = Deno.env.get("FRONTEND_URL") || "*";

    const headers = new Headers();
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, apikey, Authorization, Prefer, x-client-info, x-supabase-auth");
    headers.set("Access-Control-Max-Age", "86400");
    headers.set("Content-Type", "application/json");
    // Do NOT set Access-Control-Allow-Credentials

    if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers });
    }

    if (req.method !== "POST") {
        return new Response(
            JSON.stringify({ error: true, message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }),
            { status: 405, headers }
        );
    }

    try {
        let body: any;
        try {
            body = await req.json();
        } catch {
            return new Response(
                JSON.stringify({ error: true, message: "Invalid JSON", code: "VALIDATION_ERROR" }),
                { status: 400, headers }
            );
        }

        if (!body.action) {
            return new Response(
                JSON.stringify({ error: true, message: "action is required", code: "VALIDATION_ERROR" }),
                { status: 400, headers }
            );
        }

        const clientIP =
            req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            req.headers.get("x-real-ip") ||
            body.ip_address ||
            "Unknown";

        const ua = req.headers.get("user-agent") || "";
        let device_type = "Desktop";
        if (/Mobile|Android|iPhone/i.test(ua)) device_type = "Mobile";
        else if (/iPad|Tablet/i.test(ua)) device_type = "Tablet";

        let browser = "Unknown";
        if (/Edg\//i.test(ua)) browser = "Edge";
        else if (/Chrome/i.test(ua)) browser = "Chrome";
        else if (/Firefox/i.test(ua)) browser = "Firefox";
        else if (/Safari/i.test(ua)) browser = "Safari";

        let os = "Unknown";
        if (/Windows/i.test(ua)) os = "Windows";
        else if (/Mac OS/i.test(ua)) os = "macOS";
        else if (/iPhone|iPad/i.test(ua)) os = "iOS";
        else if (/Android/i.test(ua)) os = "Android";
        else if (/Linux/i.test(ua)) os = "Linux";

        const logEntry = {
            action: body.action,
            details: body.details || {},
            ip_address: clientIP,
            ip_country: body.ip_country || "Unknown",
            ip_city: body.ip_city || "Unknown",
            device_type: body.device_type || device_type,
            browser: body.browser || browser,
            os: body.os || os,
            screen_size: body.screen_size || null,
            referrer: body.referrer || req.headers.get("referer") || null,
            session_id: body.session_id || null,
        };

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false },
        });

        const { data: inserted, error } = await supabase
            .from("activity_log")
            .insert(logEntry)
            .select("id")
            .single();

        if (error) {
            console.error("Insert error:", error);
            return new Response(
                JSON.stringify({ error: true, message: "Failed to log", code: "INTERNAL_ERROR" }),
                { status: 500, headers }
            );
        }

        return new Response(
            JSON.stringify({ logged: true, id: inserted?.id }),
            { status: 200, headers }
        );
    } catch (err) {
        console.error("log-activity error:", err);
        return new Response(
            JSON.stringify({ error: true, message: String(err), code: "INTERNAL_ERROR" }),
            { status: 500, headers }
        );
    }
});
