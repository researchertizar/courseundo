// ==========================================================================
// Edge Function: send-notification
// Purpose: Send email notifications via Resend
// ==========================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "";
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": Deno.env.get("FRONTEND_URL") || "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, Prefer, x-client-info",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};


type NotificationType =
    | "new_suggestion"
    | "new_rating"
    | "suggestion_approved"
    | "suggestion_rejected"
    | "failed_login"
    | "rate_limit_hit"
    | "ai_service_down";

interface NotificationInput {
    type: NotificationType;
    data: Record<string, any>;
}

function buildEmail(type: NotificationType, data: Record<string, any>): {
    to: string;
    subject: string;
    body: string;
} {
    const adminUrl = `${FRONTEND_URL}/admin.html`;

    switch (type) {
        case "new_suggestion":
            return {
                to: ADMIN_EMAIL,
                subject: `New Course Suggestion: ${data.title || "Untitled"}`,
                body: `A new course suggestion has been submitted on Courseundo.

Course Title: ${data.title || "N/A"}
Link: ${data.link || "N/A"}
Platform: ${data.platform || "N/A"}
Submitted by: ${data.user_name || "Anonymous"}${data.user_email ? ` (${data.user_email})` : ""}
Notes: ${data.notes || "None"}

Submitted from: ${data.device_type || "Unknown"}, ${data.browser || "Unknown"}, ${data.ip_country || "Unknown"} (${data.ip_address || "Unknown IP"})
Time: ${data.created_at || new Date().toISOString()}

Review this suggestion in your admin dashboard:
${adminUrl}#suggestions`,
            };

        case "new_rating":
            return {
                to: ADMIN_EMAIL,
                subject: `New Rating: ${data.rating || "?"} stars on ${data.course_title || "a course"}`,
                body: `A new rating has been submitted on Courseundo.

Course: ${data.course_title || "N/A"}
Rating: ${data.rating || "?"} / 5 stars
From: ${data.ip_address || "Unknown IP"}, ${data.device_type || "Unknown"}
Time: ${new Date().toISOString()}

View ratings in your admin dashboard:
${adminUrl}#ratings`,
            };

        case "suggestion_approved":
            return {
                to: data.user_email || ADMIN_EMAIL,
                subject: `Your course suggestion was approved!`,
                body: `Great news! Your course suggestion has been approved on Courseundo.

Course: ${data.title || "N/A"}
Link: ${data.link || "N/A"}

The course is now live on the platform. Thank you for contributing!
${FRONTEND_URL}`,
            };

        case "suggestion_rejected":
            return {
                to: data.user_email || ADMIN_EMAIL,
                subject: `Update on your course suggestion`,
                body: `Thank you for your course suggestion on Courseundo.

Unfortunately, your suggestion was not approved at this time.

Course: ${data.title || "N/A"}
Link: ${data.link || "N/A"}

This may be because the course already exists, the link is broken, or the content doesn't meet our guidelines. Feel free to submit another suggestion anytime.
${FRONTEND_URL}`,
            };

        case "failed_login":
            return {
                to: ADMIN_EMAIL,
                subject: `Security Alert: Failed login attempt`,
                body: `A failed login attempt was detected on the Courseundo admin dashboard.

IP Address: ${data.ip_address || "Unknown"}
Device: ${data.device_type || "Unknown"}
Browser: ${data.browser || "Unknown"}
Country: ${data.ip_country || "Unknown"}
Time: ${data.timestamp || new Date().toISOString()}

If this was not you, consider changing your password.`,
            };

        case "rate_limit_hit":
            return {
                to: ADMIN_EMAIL,
                subject: `Security Alert: Rate limit exceeded`,
                body: `A rate limit was exceeded on Courseundo.

IP Address: ${data.ip_address || "Unknown"}
Endpoint: ${data.endpoint || "Unknown"}
Request Count: ${data.count || "?"}
Time: ${new Date().toISOString()}

This may indicate bot activity or abuse. Monitor your activity logs:
${adminUrl}#logs`,
            };

        case "ai_service_down":
            return {
                to: ADMIN_EMAIL,
                subject: `System Alert: AI services unavailable`,
                body: `Both AI classification services (Groq and Gemini) have failed on Courseundo.

Time: ${new Date().toISOString()}
Context: ${data.context || "Classification request"}

The system will continue to function with manual input. Check API keys and service status:
- Groq: https://console.groq.com
- Gemini: https://aistudio.google.com`,
            };

        default:
            return {
                to: ADMIN_EMAIL,
                subject: `Courseundo Notification: ${type}`,
                body: `Notification type: ${type}\nData: ${JSON.stringify(data, null, 2)}`,
            };
    }
}

async function sendEmail(
    to: string,
    subject: string,
    body: string
): Promise<boolean> {
    if (!RESEND_API_KEY) {
        console.error("RESEND_API_KEY not set");
        return false;
    }

    if (!to) {
        console.error("No recipient email address");
        return false;
    }

    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: "Courseundo <onboarding@resend.dev>",
                to: [to],
                subject,
                text: body,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Resend API error:", response.status, errorText);
            return false;
        }

        const data = await response.json();
        console.log("Email sent successfully:", data.id);
        return true;
    } catch (err) {
        console.error("Email send failed:", err);
        return false;
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
        const body: NotificationInput = await req.json();
        const { type, data } = body;

        if (!type) {
            return new Response(
                JSON.stringify({
                    error: true,
                    message: "Notification type is required",
                    code: "VALIDATION_ERROR",
                }),
                { status: 400, headers: CORS_HEADERS }
            );
        }

        const email = buildEmail(type as NotificationType, data || {});
        const sent = await sendEmail(email.to, email.subject, email.body);

        // For suggestion_approved/rejected, also notify submitter
        if (
            (type === "suggestion_approved" || type === "suggestion_rejected") &&
            data.user_email &&
            data.user_email !== ADMIN_EMAIL
        ) {
            await sendEmail(data.user_email, email.subject, email.body);
        }

        return new Response(
            JSON.stringify({
                sent,
                recipient: email.to,
                type,
            }),
            { status: 200, headers: CORS_HEADERS }
        );
    } catch (err) {
        console.error("send-notification error:", err);
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
