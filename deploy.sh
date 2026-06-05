#!/bin/bash

# CourseUndo Deployment Script
# Deploys all functions and migrations to Supabase

set -e

echo "🚀 CourseUndo Deployment Script"
echo "================================"

# Check environment variables
if [ -z "$SUPABASE_PROJECT_ID" ]; then
    echo "❌ Error: SUPABASE_PROJECT_ID environment variable not set"
    exit 1
fi

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "❌ Error: SUPABASE_ACCESS_TOKEN environment variable not set"
    exit 1
fi

# Change to supabase directory
cd "$(dirname "$0")/supabase" || exit 1

echo "📦 Installing Supabase CLI..."
# Supabase CLI should be installed globally or via npm

echo "🔄 Deploying functions..."

# Deploy individual functions
supabase functions deploy classify-course --project-ref "$SUPABASE_PROJECT_ID"
supabase functions deploy extract-metadata --project-ref "$SUPABASE_PROJECT_ID"
supabase functions deploy generate-embedding --project-ref "$SUPABASE_PROJECT_ID"
supabase functions deploy semantic-search --project-ref "$SUPABASE_PROJECT_ID"
supabase functions deploy send-notification --project-ref "$SUPABASE_PROJECT_ID"
supabase functions deploy log-activity --project-ref "$SUPABASE_PROJECT_ID"

echo "📊 Pushing database migrations..."
supabase db push --project-ref "$SUPABASE_PROJECT_ID"

echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Visit https://app.supabase.com to verify deployment"
echo "2. Configure environment variables in .env"
echo "3. Test the functions via API"

exit 0
