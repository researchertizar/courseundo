# CourseUndo

A semantic course discovery and matching platform powered by AI and vector embeddings.

## Features

- 🔍 Semantic course search using pgvector
- 🤖 AI-powered course classification
- 📊 Real-time course metadata extraction
- 🔗 Vector-based course matching
- 📧 Email notifications
- 📈 Activity logging and analytics

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Supabase (PostgreSQL + pgvector)
- **Cloud Functions**: TypeScript (Deno runtime)
- **AI**: OpenAI embeddings API
- **Deployment**: GitHub Actions to Supabase

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase CLI
- Git

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/courseundo.git
cd courseundo
```

2. Set up environment variables
```bash
cp supabase/.env.example supabase/.env.local
```

3. Start the Supabase development server
```bash
supabase start
```

4. Deploy functions
```bash
./deploy.sh
```

## Project Structure

- `/` - Static files (HTML, CSS, JavaScript)
- `/supabase` - Supabase configuration and functions
- `/supabase/functions` - Edge functions for backend logic
- `/.github/workflows` - GitHub Actions CI/CD

## API Documentation

### Cloud Functions

- **classify-course** - Classify courses using AI
- **extract-metadata** - Extract metadata from URLs
- **generate-embedding** - Generate vector embeddings
- **semantic-search** - Search courses by semantic similarity
- **send-notification** - Send email notifications
- **log-activity** - Log user activities

## Development

Start development server:
```bash
supabase start
```

Deploy functions:
```bash
supabase functions deploy
```

## Deployment

Automatic deployment on push to main branch via GitHub Actions.

## License

MIT
