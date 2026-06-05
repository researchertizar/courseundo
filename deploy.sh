#!/bin/bash
# ==========================================================================
# Courseundo — Deployment Script
# Usage: chmod +x deploy.sh && ./deploy.sh
# ==========================================================================

set -e

echo "========================================"
echo "  Courseundo — Deployment"
echo "========================================"
echo ""

# Check prerequisites
if ! command -v supabase &> /dev/null; then
    echo "ERROR: Supabase CLI not found."
    echo "Install it: npm install -g supabase"
    exit 1
fi

# Check if linked to a project
if ! supabase projects list &> /dev/null; then
    echo "ERROR: Not logged in to Supabase."
    echo "Run: supabase login"
    exit 1
fi

echo "Step 1: Linking to Supabase project..."
echo "  (Skip if already linked)"
echo ""
# Uncomment and set your project ref:
# supabase link --project-ref YOUR_PROJECT_REF

echo "Step 2: Deploying Edge Functions..."
echo ""

FUNCTIONS=(
  "classify-course"
  "extract-metadata"
  "generate-embedding"
  "semantic-search"
  "send-notification"
  "log-activity"
)

for fn in "${FUNCTIONS[@]}"; do
  echo "  Deploying: $fn"
  supabase functions deploy "$fn"
  echo "  ✓ $fn deployed"
done

echo ""
echo "Step 3: Setting environment secrets..."
echo "  (Skipped — set manually with: supabase secrets set KEY=VALUE)"
echo ""

echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Set secrets: supabase secrets set GROQ_API_KEY=xxx GEMINI_API_KEY=xxx RESEND_API_KEY=xxx"
echo "  2. Set secrets: supabase secrets set ADMIN_EMAIL=admin@example.com FRONTEND_URL=https://..."
echo "  3. Push frontend files to GitHub"
echo "  4. Enable GitHub Pages"
echo "  5. Update SUPABASE_URL and SUPABASE_ANON_KEY in js/app.js and js/admin.js"
echo ""
echo "Test: curl https://YOUR_REF.supabase.co/functions/v1/classify-course -H 'Authorization: Bearer YOUR_ANON_KEY'"
