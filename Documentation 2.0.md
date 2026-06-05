# Courseundo — Complete Platform Documentation

**Version 2.0 | Production Edition**
**Last Updated: June 2026**
**Website:** `https://yourusername.github.io/courseundo`
**Backend:** Supabase (PostgreSQL + Edge Functions + pgvector)

---

## Table of Contents

1. Platform Overview
2. Architecture & Technology Stack
3. Features
4. Setup & Installation Guide
5. User Guide — Public Interface
6. User Guide — Admin Dashboard
7. API Reference
8. Database Schema
9. Edge Functions Reference
10. AI Integration Details
11. Notification System
12. Activity Logging & Analytics
13. Security & Privacy
14. Troubleshooting & Common Issues
15. Performance & Scalability
16. Roadmap & Future Enhancements
17. License & Acknowledgements
18. Appendices

---

## 1. Platform Overview

Courseundo is a free, open-source platform for discovering, organizing, and sharing online courses. It is designed to run entirely at zero cost while delivering a professional, scalable experience.

**Core capabilities:**

- **Public search** with keyword filters and AI-powered semantic search using natural language queries.
- **Community suggestions** — any user can recommend courses. Suggestions are displayed publicly as "pending review" and are sent to the admin instantly for approval.
- **Public ratings** — any user can rate courses on a 1-5 star scale. No login required.
- **Admin dashboard** for adding, editing, archiving, and managing courses with automatic metadata extraction and AI classification.
- **Bulk import and export** — admins can add or extract courses in CSV and JSON format.
- **Comprehensive logging** — every user action (searches, clicks, suggestions, ratings) is recorded with device, location, and session data.
- **Instant notifications** — the admin is notified immediately via email whenever a user submits a suggestion, rating, or when a security event occurs.
- **Analytics dashboard** — admins can view search trends, popular courses, user demographics, and platform usage over time.

**Zero-cost technology stack:**

| Component | Service | Free Tier |
|---|---|---|
| Frontend hosting | GitHub Pages | Unlimited static hosting |
| Backend + Database | Supabase | 500MB DB, 50K MAU, 500K function invocations/month |
| Vector search | Supabase pgvector | Included with database (no separate service) |
| AI classification | Groq (primary) | 14,400 requests/day |
| AI fallback | Gemini | 15 RPM, 1,500 RPD |
| Embeddings | Gemini | Included with Gemini free tier |
| Metadata extraction | Mate.tools / OpenUnfurl | No rate limits (public APIs) |
| Email notifications | Resend | 100 emails/day |
| **Total cost** | | **$0/month** |

---

## 2. Architecture & Technology Stack

### System Architecture

```
┌─────────────────┐         ┌───────────────────────────────────────────┐
│                 │  REST   │           SUPABASE                       │
│  GitHub Pages   │────────▶│                                           │
│  (Frontend)     │   API   │  ┌───────────────────────────────────┐    │
│                 │◀────────│  │     PostgreSQL Database            │    │
│  • index.html   │         │  │                                    │    │
│  • admin.html   │         │  │  • courses (with pgvector)         │    │
│  • style.css    │         │  │  • suggestions                     │    │
│  • app.js       │         │  │  • ratings                         │    │
│  • admin.js     │         │  │  • activity_log                    │    │
│                 │         │  └───────────────────────────────────┘    │
└─────────────────┘         │                                           │
                            │  ┌───────────────────────────────────┐    │
                            │  │     Edge Functions (Serverless)     │    │
                            │  │                                    │    │
                            │  │  • classify-course                 │    │
                            │  │  • extract-metadata                │    │
                            │  │  • generate-embedding              │    │
                            │  │  • semantic-search                 │    │
                            │  │  • send-notification               │    │
                            │  │  • log-activity                    │    │
                            │  └───────────────────────────────────┘    │
                            │                                           │
                            │  ┌───────────────────────────────────┐    │
                            │  │     Auth                           │    │
                            │  │  • Admin login (email/password)    │    │
                            │  │  • JWT tokens                      │    │
                            │  │  • Row Level Security (RLS)        │    │
                            │  └───────────────────────────────────┘    │
                            └───────────────────────────────────────────┘
                                              │
                                              │ API calls
                                              ▼
                            ┌───────────────────────────────────────────┐
                            │       External Free Services              │
                            │                                           │
                            │  Groq       → AI classification (primary) │
                            │  Gemini     → Embeddings + AI fallback    │
                            │  Mate.tools → Metadata extraction         │
                            │  Resend     → Email notifications         │
                            └───────────────────────────────────────────┘
```

### Component Overview

| Component | Technology | Purpose | Free Tier Limits |
|---|---|---|---|
| Frontend hosting | GitHub Pages | Serve static HTML/CSS/JS | Unlimited |
| Database | Supabase PostgreSQL | Store courses, suggestions, ratings, logs | 500MB storage |
| Vector search | Supabase pgvector | Semantic similarity search | Included with DB |
| Backend logic | Supabase Edge Functions | API endpoints, AI calls, notifications | 500K invocations/month |
| Authentication | Supabase Auth | Admin login with JWT | 50K monthly active users |
| Row Level Security | PostgreSQL RLS policies | Public read, admin write | Included |
| AI classification | Groq (Llama 3.3 70B) | Categorize courses automatically | 14,400 requests/day |
| AI fallback | Gemini 2.0 Flash | Classification when Groq is down | 15 RPM, 1,500 RPD |
| Embeddings | Gemini embedding-001 | Generate 768-dim vectors for search | Included with Gemini |
| Metadata extraction | Mate.tools + OpenUnfurl | Fetch title, platform, description from URL | Public APIs, no limits |
| Email notifications | Resend | Notify admin of new submissions | 100 emails/day |

### Data Flow

**Public search:**
1. User enters query in the search bar.
2. Frontend sends request to Supabase Edge Function `semantic-search`.
3. Edge Function generates an embedding of the query using Gemini.
4. Edge Function queries PostgreSQL with pgvector for the top 20 similar courses.
5. Edge Function also logs the search action to `activity_log`.
6. Results are returned and rendered as course cards.

**Course suggestion:**
1. User fills in the suggestion form and submits.
2. Frontend inserts into the `suggestions` table via Supabase REST API.
3. Frontend calls `log-activity` Edge Function to record the action.
4. The `send-notification` Edge Function fires and emails the admin.
5. The suggestion appears publicly under "Community Suggestions" as "Pending Review."
6. Admin reviews and approves or rejects from the dashboard.

**Admin adds a course:**
1. Admin enters a URL and clicks "Auto-fetch Metadata."
2. Frontend calls `extract-metadata` Edge Function (Mate.tools → OpenUnfurl fallback).
3. Admin clicks "AI Classify."
4. Frontend calls `classify-course` Edge Function (Groq → Gemini fallback).
5. Admin reviews suggested values, fills remaining fields, and clicks "Save."
6. Course is inserted into the `courses` table.
7. `generate-embedding` Edge Function creates a vector and stores it in the `embedding` column.
8. Activity is logged.

---

## 3. Features

### Public Interface

- **Keyword search** — searches title, platform, institution, instructor, and extra fields.
- **AI semantic search** — natural language queries like *"beginner Python with free certificate and job placement in Europe"* return conceptually related courses, not just keyword matches.
- **Filters** — filter by platform, category, certification, job availability, difficulty, and cost.
- **Sorting** — sort by relevance, rating (high/low), newest/oldest, alphabetical, duration, or cost (free first).
- **Course suggestion form** — anyone can recommend a course. Suggestions appear publicly as "Pending Review" and trigger an admin notification.
- **Public ratings** — anyone can rate courses on a 1-5 star scale. One rating per user per course (tracked by IP and device fingerprint). No login required.
- **Community Suggestions tab** — displays all pending course suggestions submitted by the public, clearly labeled as unverified.
- **Pagination** — 20 courses per page (configurable), with page navigation.
- **Duplicate detection** — when suggesting a course, the system checks if the URL already exists and warns the user.
- **Responsive card layout** — course cards with color-coded badges for platform, category, difficulty, cost, certification, and job availability.
- **Accessibility** — WCAG 2.1 AA compliant. Full keyboard navigation, screen reader support, semantic HTML, proper contrast ratios.
- **Data freshness indicator** — each course card shows "Last checked: X days ago" with color-coded freshness (green < 7 days, yellow < 90 days, red > 90 days).
- **Error feedback** — clear, friendly error messages when things go wrong (network errors, rate limits, empty results).

### Admin Dashboard (Authentication-Protected)

- **Supabase Auth login** — secure email/password authentication with JWT tokens. Session expires after 1 hour.
- **Courses tab** — add, edit, archive, and restore courses. All 22 core fields plus flexible `extra_fields` JSON column.
- **Bulk import** — upload CSV or JSON files to add multiple courses at once. Validation preview before import. AI classification applied to each imported course.
- **Bulk export** — download all courses as CSV or JSON.
- **Auto-fetch metadata** — enter a course URL and the system fetches title, platform, and description from the page using free APIs (Mate.tools primary, OpenUnfurl fallback).
- **AI classification** — automatically suggests category, difficulty, duration estimate, and job relevance using Groq (primary) or Gemini (fallback). Results populate the form but can be overridden before saving.
- **Suggestions tab** — view all pending community suggestions. Approve (converts to course with optional editing), edit and approve, or reject. Approval and rejection trigger notification emails to the submitter (if they provided an email).
- **Ratings management** — view rating distribution per course. Flag and remove suspicious ratings (same IP, rapid submissions).
- **Activity log viewer** — searchable, filterable table of all logged actions. Filter by action type, date range, IP address, device type. Export logs as CSV.
- **Analytics dashboard** — overview cards (total courses, suggestions, searches, clicks), charts (search trends, most searched terms, most clicked courses, filter usage, traffic by device and country, peak usage hours), and actionable insights.
- **Notifications indicator** — badge counter on the Suggestions tab showing pending items.
- **Field validation with hints** — every field has dropdown suggestions or placeholder hints. Difficulty is a strict dropdown (Beginner/Intermediate/Advanced). Cost is a strict dropdown (Free/Paid/Subscription/Freemium). Other fields have suggested values but allow custom input.
- **Soft delete / archive** — "Archive" hides a course from public view but keeps it in the admin dashboard. Courses can be restored from archive. Permanent deletion is only available from the archive view with a confirmation dialog.
- **Mark as Verified** — updates the `last_verified` timestamp on a course, indicating the information has been checked.

### Backend (Supabase Edge Functions)

- REST endpoints for courses, suggestions, ratings, semantic search, metadata extraction, AI classification, and activity logging.
- Admin authentication via Supabase Auth with JWT tokens.
- Automatic embedding generation and pgvector sync on course save/update.
- Automatic embedding removal on course archive/permanent delete.
- Rate limiting on all public endpoints.
- Input sanitization on all user-submitted data.
- CORS restricted to the frontend domain.
- Email notifications via Resend for new suggestions, ratings, and security events.
- Comprehensive error handling with standard error response format.

---

## 4. Setup & Installation Guide

### Prerequisites

- A **Google account** (for GitHub and optional services).
- A **GitHub account** (for frontend hosting).
- A **Supabase account** (free — sign up at [supabase.com](https://supabase.com)).
- API keys (all free):
  - **Groq** — sign up at [console.groq.com](https://console.groq.com), get API key.
  - **Gemini** — get API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey), enable the API.
  - **Resend** — sign up at [resend.com](https://resend.com), get API key (free: 100 emails/day).
  - **Mate.tools** — public API, no key needed.
  - **OpenUnfurl** — public API, no key needed.

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New Project**.
3. Choose a name (e.g., `courseundo`), set a strong database password, and select a region close to your users.
4. Wait 1-2 minutes for the project to be provisioned.
5. Go to **Settings → API** and copy:
   - **Project URL** (e.g., `https://xyzcompany.supabase.co`)
   - **Anon public key** (starts with `eyJ...`)
   - **Service role key** (starts with `eyJ...` — keep this secret, used only in Edge Functions)

### Step 2: Set Up Database Schema

1. In the Supabase dashboard, go to **SQL Editor**.
2. Click **New Query**.
3. Paste the complete schema from [Section 8: Database Schema](#8-database-schema).
4. Click **Run** to create all tables, indexes, and policies.
5. Go to **Database → Extensions** and verify that `vector` (pgvector) is enabled. If not, search for it and enable it.

### Step 3: Configure Authentication

1. In the Supabase dashboard, go to **Authentication → Providers**.
2. Ensure **Email** provider is enabled (it is by default).
3. Go to **Authentication → Users** and click **Invite User**.
4. Enter the admin email address. The admin will receive an invitation to set their password.
5. This is the only admin account. All admin operations require this authentication.

### Step 4: Deploy Edge Functions

1. Install the Supabase CLI on your local machine:

   ```bash
   npm install -g supabase
   ```

2. Log in to Supabase CLI:

   ```bash
   supabase login
   ```

3. Link to your project:

   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

4. Create and deploy each Edge Function. The six functions are:

   ```
   supabase functions deploy classify-course
   supabase functions deploy extract-metadata
   supabase functions deploy generate-embedding
   supabase functions deploy semantic-search
   supabase functions deploy send-notification
   supabase functions deploy log-activity
   ```

5. Set environment variables (secrets) for Edge Functions:

   ```bash
   supabase secrets set GROQ_API_KEY=your_groq_key
   supabase secrets set GEMINI_API_KEY=your_gemini_key
   supabase secrets set RESEND_API_KEY=your_resend_key
   supabase secrets set ADMIN_EMAIL=admin@example.com
   supabase secrets set FRONTEND_URL=https://your-username.github.io/courseundo
   ```

6. Verify each function is accessible:

   ```bash
   curl https://YOUR_PROJECT_REF.supabase.co/functions/v1/classify-course \
     -H "Authorization: Bearer YOUR_ANON_KEY"
   ```

### Step 5: Deploy Frontend to GitHub Pages

1. Create a new public GitHub repository named `courseundo`.
2. Upload the frontend files:
   - `index.html` (public interface)
   - `admin.html` (admin dashboard)
   - `css/style.css`
   - `js/app.js` (public logic)
   - `js/admin.js` (admin logic)
   - `README.md` (optional)
3. In `js/app.js` and `js/admin.js`, update the configuration:

   ```javascript
   const SUPABASE_URL = 'https://your-project-ref.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-key';
   ```

4. Go to repository **Settings → Pages**:
   - Source: `Deploy from a branch`
   - Branch: `main`, folder: `/ (root)`
   - Click **Save**
5. After 1-2 minutes, your site is live at:
   `https://your-username.github.io/courseundo`

### Step 6: Configure Email Notifications

1. In the Resend dashboard ([resend.com](https://resend.com)), go to **API Keys** and copy your key (already set in Step 4).
2. Go to **Domains** and add your domain (optional — for custom sender address). Alternatively, use the default `onboarding@resend.dev` for testing.
3. In your `send-notification` Edge Function, set the `from` address:

   ```javascript
   from: 'Courseundo <notifications@yourdomain.com>'
   // or for testing:
   from: 'Courseundo <onboarding@resend.dev>'
   ```

### Step 7: Verify Installation

1. **Public site** — visit `https://your-username.github.io/courseundo`. You should see the search interface with an empty course list.
2. **Admin login** — visit `/admin.html` and log in with the invited admin email and password.
3. **Add a test course** — enter a course URL, click "Auto-fetch Metadata," click "AI Classify," fill required fields (title, link), and click "Save."
4. **Verify embedding** — go to Supabase dashboard → Table Editor → `courses` → verify the `embedding` column has a vector value.
5. **Test public search** — search for the course by keyword and by semantic query.
6. **Test suggestion** — in a separate browser (not logged in as admin), submit a course suggestion. Verify it appears in "Community Suggestions" and that the admin receives an email notification.
7. **Test rating** — rate the test course. Verify the star rating appears on the card.
8. **Test admin notifications** — check the admin email inbox for the suggestion notification.
9. **Test logging** — go to admin dashboard → Activity Log. Verify that the search, suggestion, and rating actions are logged.

---

## 5. User Guide — Public Interface

### Access

**URL:** `https://your-username.github.io/courseundo`

No login required. All features are available to everyone.

### Searching Courses

**Keyword Search**

Type words into the search bar and press Enter or click the search icon. The search covers: title, platform, institution, instructor, and extra fields. Results are displayed as paginated course cards.

**AI Semantic Search**

Enter a natural language query describing what you are looking for. Examples:

- *"machine learning with free certificate and job help"*
- *"beginner Python course in Spanish"*
- *"data science bootcamp with career support in Europe"*

The system uses AI embeddings to find conceptually related courses, not just keyword matches. Semantic search works best with descriptive phrases rather than single words.

**Filters**

Use the dropdown filters below the search bar to refine results:

| Filter | Options |
|---|---|
| Platform | Coursera, edX, Udemy, Khan Academy, Udacity, FutureLearn, LinkedIn Learning, Other |
| Category | Programming, Data Science, AI/ML, Business, Design, Language, Math, Science, Other |
| Certification | Yes, No |
| Job Availability | Yes, No |
| Difficulty | Beginner, Intermediate, Advanced |
| Cost | Free, Paid, Subscription, Freemium |

Multiple filters can be combined. Filters work with both keyword and semantic search.

**Sorting**

Use the sort dropdown to order results:

| Sort Option | Description |
|---|---|
| Relevance | Default for searches; by match quality |
| Rating: High to Low | Highest rated courses first |
| Rating: Low to High | Lowest rated courses first |
| Newest First | Most recently added courses first |
| Oldest First | Oldest courses first |
| Alphabetical: A-Z | Title ascending |
| Alphabetical: Z-A | Title descending |
| Duration: Short to Long | Shortest courses first |
| Duration: Long to Short | Longest courses first |
| Cost: Free First | Free courses appear before paid |

Your last used sort preference is saved in your browser for future visits.

**Pagination**

Courses are displayed 20 per page. Click page numbers at the bottom to navigate. The total number of results and pages is displayed.

### Viewing Course Cards

Each course card displays:

**Always shown:**
- Title (clickable link to the course)
- Platform badge (color-coded)
- Category badge (color-coded)
- Star rating: average score and number of ratings (e.g., ★★★★☆ 4.2 (127))
- Last verified indicator: "Last checked: X days ago" (green if < 7 days, yellow if < 90 days, red if > 90 days)

**Shown if available:**
- Difficulty badge (Beginner = green, Intermediate = blue, Advanced = orange)
- Cost badge (Free = green, Paid = blue, Subscription = purple)
- Certification badge (if yes)
- Job availability badge (if yes, purple)
- Duration
- Institution
- Instructor

**Badges not shown if the field is empty** — empty fields are hidden, not displayed as "Unknown" or "N/A."

### Rating a Course

1. Click on the star area of any course card.
2. A 5-star picker appears. Click to select your rating (1-5).
3. Your rating is submitted instantly. No login required.
4. The updated average and count appear on the card.
5. You can rate each course only once. The system tracks this by your IP address and device fingerprint to prevent duplicate ratings.

### Community Suggestions

Click the **"Community Suggestions"** tab to browse all pending course suggestions submitted by other users.

Each suggestion card shows:
- Course title
- Link (clickable)
- Platform (if provided)
- Submitter's notes (if provided)
- "Pending Review" badge
- Submission date

These are courses the community has recommended but the admin has not yet verified. They may contain inaccurate information.

### Suggesting a Course

Click the **"Suggest a Course"** tab. Fill in the form:

| Field | Required? | Description |
|---|---|---|
| Course Title | Yes | Name of the course |
| Course URL | Yes | Link to the course page |
| Platform | No | Coursera, edX, Udemy, etc. |
| Your Name | No | Displayed with the suggestion (optional) |
| Your Email | No | Used only to notify you when your suggestion is reviewed |
| Your Notes | No | Why you recommend this course, or any additional info |

**Duplicate detection:** As you type the URL, the system checks if this course already exists. If a match is found, you will see a warning: *"This course already exists: [course title]."* You can choose to view the existing course or submit anyway.

**Spam protection:** The form includes invisible bot detection. Submissions are rate-limited to 5 per hour per user.

**After submission:** Your suggestion appears immediately in the "Community Suggestions" tab. The admin is notified instantly by email. You will receive an email notification when your suggestion is approved or rejected (if you provided your email).

---

## 6. User Guide — Admin Dashboard

### Access & Login

**URL:** `https://your-username.github.io/courseundo/admin.html`

Enter the admin email and password configured during installation. Authentication is handled by Supabase Auth with JWT tokens. The session expires after 1 hour. After expiry, you must log in again.

### Courses Tab

#### Adding a New Course

1. Fill in the course fields. Only **title** and **link** are required. All other fields are optional — empty fields are not stored and will not appear on course cards.
2. Use the field hints and dropdown suggestions to ensure consistent data:

| Field | Type | Hint / Allowed Values |
|---|---|---|
| Title | Text | 5-200 characters (required) |
| Link | URL | Valid https URL (required) |
| Platform | Text with suggestions | Coursera, edX, Udemy, Khan Academy, Udacity, FutureLearn, LinkedIn Learning, Other |
| Category | Text with suggestions | Programming, Data Science, AI/ML, Business, Design, Language, Math, Science, Other |
| Institution | Text | University or company name |
| Instructor | Text | Lead instructor name(s) |
| Difficulty | Dropdown only | Beginner, Intermediate, Advanced |
| Duration | Text | e.g., "40 hours", "6 weeks" |
| Mode | Text with suggestions | Self-paced, Instructor-led |
| Format | Text with suggestions | Video, Text, Interactive, Mixed |
| Cost | Dropdown only | Free, Paid, Subscription, Freemium |
| Certification | Dropdown only | Yes, No |
| Certification Type | Text with suggestions | Free, Paid, Verified, Industry Badge |
| Validation | Text | Accredited, Industry badge, etc. |
| Job Availability | Dropdown only | Yes, No |
| Job Country | Text | e.g., "USA, India, Remote" |
| Job Salary Range | Text | e.g., "$60k-$90k" |
| Job Mode | Text with suggestions | Remote, On-site, Hybrid |
| Language | Text with suggestions | English, Spanish, French, etc. |
| Rating | Number | 0-5 (one decimal place) — auto-calculated from user ratings |
| Extra Fields | JSON | Any additional structured data |
| Last Verified | Auto-set | Updated when "Mark as Verified" is clicked |

3. **Auto-fetch Metadata** — after entering the course URL, click this button. The system fetches the title, platform, and description from the course page using Mate.tools (primary) and OpenUnfurl (fallback). If both fail, enter the information manually.
4. **AI Classify** — click to automatically suggest category, difficulty, duration, and job relevance. The system uses Groq (primary) and Gemini (fallback). Suggested values populate the form fields. You can override any value before saving.
5. **Extra Fields (JSON)** — for data not covered by standard fields, enter valid JSON:

   ```json
   {
     "prerequisite": "Basic Python",
     "projects": 3,
     "language_subtitles": ["Spanish", "French"]
   }
   ```

   The field has a real-time JSON validator. Invalid JSON is highlighted with a red border and an error message. Valid JSON shows a green border.

6. Click **Save Course** to create or update. The system will:
   - Validate all fields.
   - Check for duplicate URLs.
   - Save to the database.
   - Generate an embedding vector and store it in pgvector.
   - Log the action.

#### Editing a Course

Click on any course in the list to load its data into the form. Make changes and click **Save Course**. The embedding is regenerated automatically if the title, category, or description changed.

#### Archiving a Course

Click the **Archive** button on any course card. A confirmation dialog appears:

> *"Archive this course? It will be hidden from public view but can be restored later."*
> [Cancel] [Archive]

Archived courses:
- Are hidden from the public interface.
- Remain visible in the admin dashboard under the **"Archived"** filter.
- Have their Pinecone vector removed (the embedding column is cleared).
- Can be restored at any time (embedding is regenerated on restore).

#### Permanent Deletion

From the **Archived** filter view, click **Delete Forever**. A confirmation dialog appears:

> *"Permanently delete this course? This cannot be undone."*
> [Cancel] [Delete Forever]

Permanent deletion removes the course from the database entirely.

#### Mark as Verified

Click **Mark as Verified** on any course to update its `last_verified` timestamp to the current date and time. This updates the "Last checked" indicator on the public course card.

### Bulk Operations Tab

#### Bulk Import

1. Click **Bulk Import**.
2. Select a CSV or JSON file.
3. The system parses and validates all rows.
4. A preview table appears showing all rows with any errors highlighted in red.
5. A summary is displayed: *"47 valid, 3 errors, 2 duplicates."*
6. Click **Import Valid Rows**.
7. Each imported course is saved to the database and an embedding is generated.
8. AI classification is applied to each course (with rate limiting to stay within API quotas).
9. Results summary: *"47 courses imported successfully, 3 skipped (errors), 2 skipped (duplicates)."*

**Required CSV columns:** `title`, `link`
**Optional CSV columns:** All other course fields (see table above).
**JSON format:** Array of course objects, each matching the course schema.

#### Bulk Export

Click **Export All** to download all active courses as CSV or JSON. Archived courses are excluded unless the "Include Archived" checkbox is selected.

### Suggestions Tab

Lists all pending course suggestions from public users, sorted by newest first.

Each suggestion shows:
- Title, URL, platform
- Submitter's notes
- Submitter's name and email (if provided)
- IP address, device type, browser, and location (from logging)
- Submission timestamp

**Actions:**

| Action | What Happens |
|---|---|
| **Approve & Add** | Pre-fills the course form with suggestion data. You can edit fields before saving. After saving, the suggestion status changes to "approved." An email notification is sent to the submitter (if they provided an email). |
| **Edit & Approve** | Same as above but explicitly opens the edit form first. |
| **Reject** | Changes the suggestion status to "rejected." The suggestion is removed from the public "Community Suggestions" view. An email notification is sent to the submitter (if they provided an email). |

**Notification badge:** The Suggestions tab shows a red badge with the count of pending suggestions.

### Ratings Management

View rating distribution for each course:
- Average rating
- Total number of ratings
- Histogram of 1-5 star distribution
- List of individual ratings with IP hash, timestamp, and device info

**Flag suspicious ratings:** If multiple ratings come from the same IP or device in a short time window, they are flagged for review. Admin can remove individual ratings.

### Activity Log Tab

A searchable, filterable table of every action recorded on the platform.

**Columns:** Timestamp, Action, Details, IP Address, Country, City, Device Type, Browser, OS, Screen Size, Referrer, Session ID

**Filters:**
- By action type (search, suggestion, rating, course_click, page_visit, admin_login, etc.)
- By date range
- By IP address
- By device type (Desktop, Mobile, Tablet)

**Actions:**
- Search logs by keyword
- Export filtered logs as CSV
- View log entry details (full JSON)

### Analytics Dashboard

**Overview Cards (top of page):**
- Total courses (active)
- Total suggestions (pending / approved / rejected / total)
- Searches today / this week / this month
- Course clicks today / this week / this month
- Active sessions (current)

**Charts:**
- Searches over time (line chart, toggle daily/weekly/monthly)
- Most searched terms (horizontal bar chart, top 20)
- Most clicked courses (horizontal bar chart, top 20)
- Most used filters (pie chart)
- Suggestions over time (line chart)
- Rating distribution across all courses (histogram)
- Traffic by device type (pie chart: Desktop, Mobile, Tablet)
- Traffic by country (table, top 20)
- Peak usage hours (heatmap: hour of day vs. day of week)

**Insights (auto-generated):**
- *"Most searches for 'Python' — consider adding more Python courses."*
- *"70% of users filter for free courses — prioritize free content."*
- *"Peak traffic between 6-9 PM UTC — schedule maintenance outside this window."*

---

## 7. API Reference

All endpoints are accessed through the Supabase Edge Functions URL pattern:

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/FUNCTION_NAME
```

Or through the Supabase REST API for direct database operations:

```
https://YOUR_PROJECT_REF.supabase.co/rest/v1/TABLE_NAME
```

### Authentication

**Public endpoints** — no authentication required. Accessed via the Supabase anon key in the `apikey` header.

**Admin endpoints** — require a valid JWT token in the `Authorization: Bearer <token>` header. Token is obtained through Supabase Auth login.

---

### Public Endpoints

#### Get All Courses (Paginated)

```
GET /rest/v1/courses?status=eq.active
    &order=created_at.desc
    &limit=20
    &offset=0

Headers:
  apikey: YOUR_ANON_KEY
  Range: 0-19
```

**Response:**
```json
[
  {
    "id": "uuid",
    "title": "Python for Data Science",
    "link": "https://coursera.org/learn/python-data-science",
    "platform": "Coursera",
    "category": "Data Science",
    "difficulty": "Beginner",
    "cost": "Free",
    "rating_avg": 4.2,
    "rating_count": 127,
    "last_verified": "2026-06-01T12:00:00Z",
    "created_at": "2026-05-15T10:00:00Z"
    // ... other fields
  }
]
```

**Pagination headers:**
```
Content-Range: 0-19/156
```

The total count (156) is in the `Content-Range` header. Use this to calculate total pages.

**Filtering examples:**
```
?category=eq.Data%20Science
?difficulty=eq.Beginner
?cost=eq.Free
?platform=eq.Coursera&difficulty=eq.Beginner
```

**Sorting examples:**
```
&order=rating_avg.desc       (highest rated)
&order=created_at.desc       (newest)
&order=title.asc             (alphabetical)
```

---

#### Keyword Search

```
GET /rest/v1/courses?status=eq.active
    &or=(title.ilike.*python*,platform.ilike.*python*,institution.ilike.*python*,instructor.ilike.*python*)
    &order=rating_avg.desc
    &limit=20&offset=0

Headers:
  apikey: YOUR_ANON_KEY
```

---

#### AI Semantic Search

```
POST /functions/v1/semantic-search

Headers:
  Authorization: Bearer YOUR_ANON_KEY
  Content-Type: application/json

Body:
{
  "query": "beginner Python with free certificate and job placement",
  "limit": 20
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "uuid",
      "title": "Python for Data Science",
      "link": "https://coursera.org/learn/python-data-science",
      "platform": "Coursera",
      "category": "Data Science",
      "similarity": 0.87,
      // ... all course fields
    }
  ],
  "query_embedding_generated": true,
  "total_results": 15
}
```

**Fallback:** If pgvector or Gemini is unavailable, the system falls back to keyword search and returns:

```json
{
  "results": [...],
  "fallback": "keyword_search",
  "reason": "Vector search unavailable, returned keyword matches"
}
```

---

#### Submit a Suggestion

```
POST /rest/v1/suggestions

Headers:
  apikey: YOUR_ANON_KEY
  Content-Type: application/json
  Prefer: return=representation

Body:
{
  "title": "Advanced Machine Learning Specialization",
  "link": "https://coursera.org/learn/advanced-ml",
  "platform": "Coursera",
  "notes": "Excellent for intermediate learners looking to specialize",
  "user_name": "Jane",
  "user_email": "jane@example.com"
}
```

**Response:**
```json
{
  "id": "uuid",
  "title": "Advanced Machine Learning Specialization",
  "link": "https://coursera.org/learn/advanced-ml",
  "platform": "Coursera",
  "notes": "Excellent for intermediate learners looking to specialize",
  "user_name": "Jane",
  "user_email": "jane@example.com",
  "status": "pending",
  "created_at": "2026-06-05T14:30:00Z"
}
```

**Side effects:** Activity is logged. Admin email notification is sent.

**Validation errors:**
```json
{
  "error": true,
  "message": "Title is required and must be between 5 and 200 characters",
  "code": "VALIDATION_ERROR",
  "field": "title"
}
```

**Duplicate detection:**
```json
{
  "error": true,
  "message": "A course with this URL already exists: Python for Data Science",
  "code": "DUPLICATE_URL",
  "existing_course_id": "uuid"
}
```

---

#### Submit a Rating

```
POST /rest/v1/ratings

Headers:
  apikey: YOUR_ANON_KEY
  Content-Type: application/json

Body:
{
  "course_id": "uuid",
  "rating": 4
}
```

**Response:**
```json
{
  "id": "uuid",
  "course_id": "uuid",
  "rating": 4,
  "created_at": "2026-06-05T14:30:00Z"
}
```

**Side effects:** The course's `rating_avg` and `rating_count` are recalculated. Activity is logged.

**Duplicate rating error:**
```json
{
  "error": true,
  "message": "You have already rated this course",
  "code": "DUPLICATE_RATING"
}
```

---

#### Get Pending Suggestions (Public)

```
GET /rest/v1/suggestions?status=eq.pending&order=created_at.desc

Headers:
  apikey: YOUR_ANON_KEY
```

Returns all pending suggestions for the "Community Suggestions" view. Sensitive fields (IP address, device info) are excluded from the public response.

---

### Admin Endpoints

All admin endpoints require authentication:

```
Headers:
  Authorization: Bearer <JWT_TOKEN>
  apikey: YOUR_ANON_KEY
```

#### Admin Login

```
POST /auth/v1/token?grant_type=password

Body:
{
  "email": "admin@example.com",
  "password": "yourpassword"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "..."
}
```

Use `access_token` in the `Authorization: Bearer <token>` header for all subsequent admin requests.

---

#### Save Course (Create or Update)

```
POST /rest/v1/courses

Headers:
  Authorization: Bearer <JWT_TOKEN>
  Prefer: return=representation

Body (new course):
{
  "title": "Python for Data Science",
  "link": "https://coursera.org/learn/python-data-science",
  "platform": "Coursera",
  "category": "Data Science",
  "difficulty": "Beginner",
  "cost": "Free",
  // ... other fields
}

Body (update existing):
{
  "id": "existing-uuid",
  "title": "Updated Title",
  // ... changed fields
}
```

For updates, use PATCH:
```
PATCH /rest/v1/courses?id=eq.existing-uuid
```

**Side effects:** Embedding is generated and stored. Activity is logged.

---

#### Archive Course

```
PATCH /rest/v1/courses?id=eq.COURSE_UUID

Body:
{
  "status": "archived",
  "embedding": null
}
```

---

#### Restore Course

```
PATCH /rest/v1/courses?id=eq.COURSE_UUID

Body:
{
  "status": "active"
}
```

Embedding is regenerated automatically.

---

#### Delete Course Permanently

```
DELETE /rest/v1/courses?id=eq.COURSE_UUID
```

---

#### Get All Suggestions (Admin — with full details)

```
GET /rest/v1/suggestions?order=created_at.desc

Headers:
  Authorization: Bearer <JWT_TOKEN>
```

Returns all suggestions including IP address, device info, and all metadata.

---

#### Approve Suggestion

```
PATCH /rest/v1/suggestions?id=eq.SUGGESTION_UUID

Body:
{
  "status": "approved",
  "reviewed_at": "2026-06-05T15:00:00Z",
  "reviewed_by": "admin@example.com"
}
```

---

#### Reject Suggestion

```
PATCH /rest/v1/suggestions?id=eq.SUGGESTION_UUID

Body:
{
  "status": "rejected",
  "reviewed_at": "2026-06-05T15:00:00Z",
  "reviewed_by": "admin@example.com"
}
```

---

#### Delete Rating

```
DELETE /rest/v1/ratings?id=eq.RATING_UUID
```

---

#### Get Activity Logs

```
GET /rest/v1/activity_log?order=timestamp.desc&limit=100&offset=0

Headers:
  Authorization: Bearer <JWT_TOKEN>
```

**Filtered:**
```
GET /rest/v1/activity_log?action=eq.search&timestamp=gte.2026-06-01
```

---

#### Auto-fetch Metadata

```
POST /functions/v1/extract-metadata

Headers:
  Authorization: Bearer <JWT_TOKEN>

Body:
{
  "url": "https://coursera.org/learn/python-data-science"
}
```

**Response:**
```json
{
  "title": "Python for Data Science and Machine Learning",
  "platform": "Coursera",
  "description": "Learn Python programming for data science...",
  "source": "mate.tools"
}
```

---

#### AI Classify

```
POST /functions/v1/classify-course

Headers:
  Authorization: Bearer <JWT_TOKEN>

Body:
{
  "title": "Python for Data Science and Machine Learning",
  "description": "Learn Python programming for data science including pandas, numpy, and machine learning basics."
}
```

**Response:**
```json
{
  "category": "Data Science",
  "difficulty": "Beginner",
  "duration": "30-40 hours",
  "job_relevance": "High",
  "model_used": "groq"
}
```

---

#### Mark as Verified

```
PATCH /rest/v1/courses?id=eq.COURSE_UUID

Body:
{
  "last_verified": "2026-06-05T15:00:00Z"
}
```

---

### Standard Error Response Format

All endpoints return errors in this format:

```json
{
  "error": true,
  "message": "Human-readable error description",
  "code": "ERROR_CODE"
}
```

**Error codes:**

| Code | HTTP Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Missing or invalid field values |
| `DUPLICATE_URL` | 409 | A course with this URL already exists |
| `DUPLICATE_RATING` | 409 | User already rated this course |
| `UNAUTHORIZED` | 401 | Missing or expired authentication token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Requested resource does not exist |
| `RATE_LIMITED` | 429 | Too many requests, try again later |
| `INTERNAL_ERROR` | 500 | Server-side failure |
| `AI_SERVICE_UNAVAILABLE` | 503 | Groq and Gemini both failed |
| `METADATA_FETCH_FAILED` | 502 | Mate.tools and OpenUnfurl both failed |
| `INVALID_JSON` | 400 | extra_fields contains invalid JSON |

---

## 8. Database Schema

### Enable Required Extensions

```sql
-- Enable pgvector for semantic search
CREATE EXTENSION IF NOT EXISTS vector;
```

### Courses Table

```sql
CREATE TABLE courses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL CHECK (length(title) BETWEEN 5 AND 200),
  link            TEXT NOT NULL UNIQUE CHECK (link ~* '^https?://'),
  platform        TEXT,
  category        TEXT,
  institution     TEXT,
  instructor      TEXT,
  difficulty      TEXT CHECK (difficulty IN ('Beginner', 'Intermediate', 'Advanced')),
  duration        TEXT,
  mode            TEXT CHECK (mode IN ('Self-paced', 'Instructor-led')),
  format          TEXT CHECK (format IN ('Video', 'Text', 'Interactive', 'Mixed')),
  cost            TEXT CHECK (cost IN ('Free', 'Paid', 'Subscription', 'Freemium')),
  certification   TEXT CHECK (certification IN ('Yes', 'No')),
  cert_type       TEXT,
  validation      TEXT,
  job_available   TEXT CHECK (job_available IN ('Yes', 'No')),
  job_country     TEXT,
  job_salary      TEXT,
  job_mode        TEXT CHECK (job_mode IN ('Remote', 'On-site', 'Hybrid')),
  language        TEXT,
  rating_avg      NUMERIC(2,1) DEFAULT 0 CHECK (rating_avg BETWEEN 0 AND 5),
  rating_count    INTEGER DEFAULT 0 CHECK (rating_count >= 0),
  extra_fields    JSONB DEFAULT '{}',
  status          TEXT DEFAULT 'active'
                    CHECK (status IN ('active', 'archived', 'broken')),
  embedding       VECTOR(768),
  last_verified   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Performance indexes
CREATE INDEX idx_courses_status ON courses(status);
CREATE INDEX idx_courses_category ON courses(category);
CREATE INDEX idx_courses_platform ON courses(platform);
CREATE INDEX idx_courses_difficulty ON courses(difficulty);
CREATE INDEX idx_courses_cost ON courses(cost);
CREATE INDEX idx_courses_rating ON courses(rating_avg DESC);
CREATE INDEX idx_courses_created ON courses(created_at DESC);
CREATE INDEX idx_courses_language ON courses(language);

-- Full-text search index
CREATE INDEX idx_courses_fts ON courses
  USING gin(to_tsvector('english', coalesce(title,'') || ' ' ||
    coalesce(platform,'') || ' ' || coalesce(institution,'') || ' ' ||
    coalesce(instructor,'')));

-- Vector similarity index for semantic search
CREATE INDEX idx_courses_embedding ON courses
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

### Suggestions Table

```sql
CREATE TABLE suggestions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL CHECK (length(title) BETWEEN 5 AND 200),
  link          TEXT NOT NULL CHECK (link ~* '^https?://'),
  platform      TEXT,
  notes         TEXT CHECK (length(notes) <= 2000),
  user_name     TEXT CHECK (length(user_name) <= 100),
  user_email    TEXT CHECK (user_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  status        TEXT DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  ip_address    TEXT,
  device_info   JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now(),
  reviewed_at   TIMESTAMPTZ,
  reviewed_by   TEXT
);

CREATE INDEX idx_suggestions_status ON suggestions(status);
CREATE INDEX idx_suggestions_created ON suggestions(created_at DESC);
```

### Ratings Table

```sql
CREATE TABLE ratings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  ip_hash       TEXT NOT NULL,
  fingerprint   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, ip_hash)
);

CREATE INDEX idx_ratings_course ON ratings(course_id);
CREATE INDEX idx_ratings_created ON ratings(created_at DESC);

-- Function to recalculate course rating average
CREATE OR REPLACE FUNCTION recalculate_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE courses
  SET
    rating_avg = (SELECT COALESCE(ROUND(AVG(rating), 1), 0) FROM ratings WHERE course_id = COALESCE(NEW.course_id, OLD.course_id)),
    rating_count = (SELECT COUNT(*) FROM ratings WHERE course_id = COALESCE(NEW.course_id, OLD.course_id))
  WHERE id = COALESCE(NEW.course_id, OLD.course_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rating_changed
  AFTER INSERT OR UPDATE OR DELETE ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_rating();
```

### Activity Log Table

```sql
CREATE TABLE activity_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp     TIMESTAMPTZ DEFAULT now(),
  action        TEXT NOT NULL,
  details       JSONB DEFAULT '{}',
  ip_address    TEXT,
  ip_country    TEXT,
  ip_city       TEXT,
  device_type   TEXT CHECK (device_type IN ('Desktop', 'Mobile', 'Tablet', 'Unknown')),
  browser       TEXT,
  os            TEXT,
  screen_size   TEXT,
  referrer      TEXT,
  session_id    TEXT
);

CREATE INDEX idx_log_action ON activity_log(action);
CREATE INDEX idx_log_timestamp ON activity_log(timestamp DESC);
CREATE INDEX idx_log_ip ON activity_log(ip_address);
CREATE INDEX idx_log_session ON activity_log(session_id);

-- Auto-delete logs older than 90 days (optional, run via cron)
-- DELETE FROM activity_log WHERE timestamp < now() - INTERVAL '90 days';
```

### Row Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- COURSES: Anyone can read active courses
CREATE POLICY "Public can read active courses"
  ON courses FOR SELECT
  USING (status = 'active');

-- COURSES: Authenticated users (admins) can do everything
CREATE POLICY "Admins can manage courses"
  ON courses FOR ALL
  USING (auth.role() = 'authenticated');

-- SUGGESTIONS: Anyone can insert suggestions
CREATE POLICY "Anyone can submit suggestions"
  ON suggestions FOR INSERT
  WITH CHECK (true);

-- SUGGESTIONS: Anyone can read pending suggestions
CREATE POLICY "Public can read pending suggestions"
  ON suggestions FOR SELECT
  USING (status = 'pending');

-- SUGGESTIONS: Authenticated users can read all suggestions
CREATE POLICY "Admins can read all suggestions"
  ON suggestions FOR SELECT
  USING (auth.role() = 'authenticated');

-- SUGGESTIONS: Authenticated users can update/delete suggestions
CREATE POLICY "Admins can manage suggestions"
  ON suggestions FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can delete suggestions"
  ON suggestions FOR DELETE
  USING (auth.role() = 'authenticated');

-- RATINGS: Anyone can insert ratings
CREATE POLICY "Anyone can submit ratings"
  ON ratings FOR INSERT
  WITH CHECK (true);

-- RATINGS: Anyone can read ratings (for display)
CREATE POLICY "Public can read ratings"
  ON ratings FOR SELECT
  USING (true);

-- RATINGS: Authenticated users can delete ratings
CREATE POLICY "Admins can delete ratings"
  ON ratings FOR DELETE
  USING (auth.role() = 'authenticated');

-- ACTIVITY LOG: Only authenticated users can read
CREATE POLICY "Admins can read activity log"
  ON activity_log FOR SELECT
  USING (auth.role() = 'authenticated');

-- ACTIVITY LOG: Anyone can insert (for logging from frontend)
CREATE POLICY "Anyone can insert activity logs"
  ON activity_log FOR INSERT
  WITH CHECK (true);
```

---

## 9. Edge Functions Reference

All Edge Functions are written in TypeScript (Deno runtime) and deployed to Supabase. Each function handles a specific backend task.

### Function 1: `classify-course`

**Purpose:** Automatically categorize a course using AI.

**Trigger:** Admin clicks "AI Classify" in the dashboard.

**Input:**
```json
{
  "title": "Python for Data Science and Machine Learning",
  "description": "Learn Python programming for data science including pandas, numpy, and machine learning basics."
}
```

**Process:**
1. Construct a classification prompt.
2. Call Groq API (Llama 3.3 70B) with the prompt.
3. If Groq fails or returns an error, call Gemini 2.0 Flash as fallback.
4. If both fail, return a clear error.
5. Parse the JSON response from the AI model.

**Prompt:**
```
Classify this online course. Return ONLY valid JSON with no additional text.

Title: {title}
Description: {description}

Return JSON:
{
  "category": "one of: Programming, Data Science, AI/ML, Business, Design, Language, Math, Science, Other",
  "difficulty": "one of: Beginner, Intermediate, Advanced",
  "duration": "estimated duration string, e.g. '30-40 hours' or '6 weeks'",
  "job_relevance": "one of: High, Medium, Low, None"
}
```

**Output:**
```json
{
  "category": "Data Science",
  "difficulty": "Beginner",
  "duration": "30-40 hours",
  "job_relevance": "High",
  "model_used": "groq"
}
```

**Error handling:**
- If Groq returns an error or times out, try Gemini.
- If Gemini also fails, return:

```json
{
  "error": true,
  "message": "AI classification unavailable. Please fill in the fields manually.",
  "code": "AI_SERVICE_UNAVAILABLE"
}
```

---

### Function 2: `extract-metadata`

**Purpose:** Fetch course title, platform, and description from a URL.

**Trigger:** Admin enters a URL and clicks "Auto-fetch Metadata."

**Input:**
```json
{
  "url": "https://coursera.org/learn/python-data-science"
}
```

**Process:**
1. Call Mate.tools POST endpoint with the URL.
2. If Mate.tools fails, call OpenUnfurl GET endpoint.
3. If both fail, return a clear error.
4. Extract title, siteName (platform), and description from the response.

**Output:**
```json
{
  "title": "Python for Data Science and Machine Learning",
  "platform": "Coursera",
  "description": "Learn Python programming for data science...",
  "source": "mate.tools"
}
```

**Error handling:**
- If both services fail:

```json
{
  "error": true,
  "message": "Could not fetch metadata from this URL. Please enter the course details manually.",
  "code": "METADATA_FETCH_FAILED"
}
```

---

### Function 3: `generate-embedding`

**Purpose:** Generate a 768-dimensional vector embedding for a course.

**Trigger:** Automatically called when a course is saved or updated.

**Input:**
```json
{
  "course_id": "uuid",
  "title": "Python for Data Science and Machine Learning",
  "description": "Learn Python programming...",
  "category": "Data Science"
}
```

**Process:**
1. Construct an embedding text from title + description + category.
2. Call Gemini `embedding-001` model.
3. Receive a 768-dimension vector.
4. Upsert the vector into the `embedding` column of the `courses` table.

**Output:**
```json
{
  "status": "ok",
  "dimensions": 768,
  "course_id": "uuid"
}
```

**Error handling:**
- If Gemini fails, the course is still saved but without an embedding.
- The course will not appear in semantic search results but will appear in keyword search.
- A retry can be triggered manually from the admin dashboard.

---

### Function 4: `semantic-search`

**Purpose:** Find courses by semantic similarity to a natural language query.

**Trigger:** Public user enters a search query.

**Input:**
```json
{
  "query": "beginner Python with free certificate and job placement",
  "limit": 20
}
```

**Process:**
1. Generate an embedding of the query using Gemini `embedding-001`.
2. Query the `courses` table using pgvector cosine similarity:

   ```sql
   SELECT *, 1 - (embedding <=> $1) AS similarity
   FROM courses
   WHERE status = 'active' AND embedding IS NOT NULL
   ORDER BY embedding <=> $1
   LIMIT $2;
   ```

3. Return the top matching courses ranked by similarity.

**Output:**
```json
{
  "results": [
    {
      "id": "uuid",
      "title": "Python for Data Science",
      "similarity": 0.87,
      // ... all course fields
    }
  ],
  "total_results": 15
}
```

**Fallback:** If pgvector or Gemini is unavailable:

```json
{
  "results": [],
  "fallback": "keyword_search",
  "message": "Semantic search unavailable. Please use keyword search."
}
```

The frontend then falls back to client-side keyword search.

---

### Function 5: `send-notification`

**Purpose:** Send email notifications to the admin and/or users.

**Trigger:** New suggestion submitted, new rating, security event (failed login, rate limit hit).

**Input:**
```json
{
  "type": "new_suggestion",
  "data": {
    "title": "Advanced Machine Learning",
    "link": "https://coursera.org/...",
    "platform": "Coursera",
    "user_name": "Jane",
    "user_email": "jane@example.com",
    "notes": "Great course for intermediate learners",
    "ip_address": "192.168.1.1",
    "device_type": "Desktop",
    "browser": "Chrome",
    "ip_country": "USA",
    "created_at": "2026-06-05T14:30:00Z"
  }
}
```

**Notification types:**

| Type | Recipient | Subject | When |
|---|---|---|---|
| `new_suggestion` | Admin | "New Course Suggestion: {title}" | User submits a suggestion |
| `new_rating` | Admin (optional) | "New Rating: {rating} stars on {course}" | User rates a course |
| `suggestion_approved` | Submitter | "Your suggestion was approved!" | Admin approves a suggestion |
| `suggestion_rejected` | Submitter | "Update on your course suggestion" | Admin rejects a suggestion |
| `failed_login` | Admin | "Security Alert: Failed login attempt" | Wrong password entered |
| `rate_limit_hit` | Admin | "Security Alert: Rate limit exceeded" | IP exceeds rate limit |
| `ai_service_down` | Admin | "System Alert: AI services unavailable" | Both Groq and Gemini fail |

**Email format (example for new suggestion):**
```
Subject: New Course Suggestion: Advanced Machine Learning

A new course suggestion has been submitted on Courseundo.

Course Title: Advanced Machine Learning
Link: https://coursera.org/...
Platform: Coursera
Submitted by: Jane (jane@example.com)
Notes: Great course for intermediate learners

Submitted from: Desktop, Chrome, USA (192.168.1.1)
Time: June 5, 2026 at 2:30 PM

Review this suggestion in your admin dashboard:
https://your-username.github.io/courseundo/admin.html#suggestions
```

**Output:**
```json
{
  "sent": true,
  "recipient": "admin@example.com",
  "type": "new_suggestion"
}
```

---

### Function 6: `log-activity`

**Purpose:** Record a user action in the activity log.

**Trigger:** Called from the frontend on every significant user action.

**Input:**
```json
{
  "action": "search",
  "details": {
    "query": "python data science",
    "results_count": 15,
    "search_type": "keyword"
  },
  "ip_address": "192.168.1.1",
  "ip_country": "USA",
  "ip_city": "New York",
  "device_type": "Desktop",
  "browser": "Chrome",
  "os": "Windows",
  "screen_size": "1920x1080",
  "referrer": "https://google.com",
  "session_id": "abc123"
}
```

**Process:**
1. Insert the data into the `activity_log` table.
2. If the action is `new_suggestion` or `new_rating`, trigger `send-notification`.

**Output:**
```json
{
  "logged": true,
  "id": "uuid"
}
```

---

## 10. AI Integration Details

### Metadata Extraction

Uses two free public APIs with automatic fallback:

1. **Mate.tools** (primary) — POST request with the course URL. Returns title, siteName, description, and OpenGraph metadata.
2. **OpenUnfurl** (fallback) — GET request with the course URL. Returns title, description, and metadata.
3. If both fail, the admin enters information manually.

Extracted data: `title`, `siteName` (used as platform), `description` (stored in `extra_fields` if not mapped to a standard field).

### AI Classification

**Primary:** Groq (Llama 3.3 70B) — fast, high capacity, 14,400 requests/day on free tier.
**Fallback:** Gemini 2.0 Flash — used when Groq fails or quota is exceeded.

The classification prompt instructs the model to return a JSON object with four fields: `category`, `difficulty`, `duration`, and `job_relevance`. The model is constrained to specific allowed values for category and difficulty.

Results populate the admin form but can be overridden before saving.

### Semantic Search Pipeline

1. User enters a natural language query in the search bar.
2. Frontend calls the `semantic-search` Edge Function.
3. The Edge Function generates a 768-dimensional embedding of the query using Gemini `embedding-001`.
4. The Edge Function queries PostgreSQL with pgvector cosine similarity to find the top 20 most similar courses.
5. Full course data is returned to the frontend, ranked by similarity score.
6. The search is logged to `activity_log`.

**Fallback:** If the embedding generation or pgvector query fails, the frontend falls back to keyword search (Supabase full-text search or client-side filtering).

### Embedding Sync

- **On course save/update:** The `generate-embedding` Edge Function is called automatically. It creates a 768-dimensional vector from the course's title, description, and category, and stores it in the `embedding` column using pgvector.
- **On course archive:** The embedding column is set to `NULL`. The course no longer appears in semantic search.
- **On course restore:** The embedding is regenerated.
- **On permanent delete:** The row (and its embedding) is removed entirely.

**Capacity:** Supabase free tier supports up to 500MB of database storage. Each embedding is approximately 6KB (768 dimensions × 8 bytes). This supports roughly **80,000 course embeddings** within the free tier, well beyond expected usage.

---

## 11. Notification System

### Overview

The notification system ensures the admin is immediately aware of all user interactions and security events. It operates through two channels:

1. **Email notifications** via Resend (primary)
2. **Dashboard badge counter** (secondary)

### Notification Triggers

| Event | Who Gets Notified | Channel | Content |
|---|---|---|---|
| New suggestion submitted | Admin | Email + Badge | Course title, URL, platform, user info, device/location, direct link to review |
| New rating submitted | Admin (configurable) | Email | Course title, rating value, device/location |
| Suggestion approved | Submitter (if email provided) | Email | Approval message, link to course |
| Suggestion rejected | Submitter (if email provided) | Email | Rejection message |
| Failed admin login | Admin | Email | IP address, device, browser, timestamp, location |
| Rate limit exceeded | Admin | Email | IP address, endpoint, request count |
| AI services down | Admin | Email | Which services failed, timestamp |

### Email Delivery

All emails are sent through Resend's API from the `send-notification` Edge Function.

- **From address:** Configured during setup (default: `notifications@yourdomain.com` or `onboarding@resend.dev` for testing).
- **Admin email:** Configured as an environment variable (`ADMIN_EMAIL`) in the Edge Function settings.
- **Rate limit:** Resend free tier allows 100 emails/day. For most platforms, this is sufficient. If exceeded, notifications are queued and sent the next day.

### Dashboard Badge

The admin dashboard checks for pending suggestions on load and displays a red badge counter on the Suggestions tab:

```
Suggestions (3)   ← red badge with count
```

This provides at-a-glance awareness even without checking email.

---

## 12. Activity Logging & Analytics

### What Gets Logged

Every significant user action is recorded in the `activity_log` table with full context:

**Public actions:**

| Action | Details Captured |
|---|---|
| `page_visit` | Page URL, referrer |
| `search` | Query text, results count, search type (keyword/semantic) |
| `semantic_search` | Query text, results count, similarity scores |
| `filter_used` | Which filter, what value |
| `sort_used` | Sort option selected |
| `course_click` | Course ID, course title, platform |
| `course_view` | Course ID (card impression) |
| `page_change` | Page number, total pages |
| `suggestion` | All suggestion fields |
| `rating` | Course ID, rating value |

**Admin actions:**

| Action | Details Captured |
|---|---|
| `admin_login` | Timestamp |
| `admin_login_fail` | IP, device, browser, timestamp |
| `course_add` | All course fields |
| `course_edit` | Course ID, changed fields, old values, new values |
| `course_archive` | Course ID, title |
| `course_restore` | Course ID, title |
| `course_delete` | Course ID, title |
| `suggestion_approve` | Suggestion ID, course title |
| `suggestion_reject` | Suggestion ID, course title |
| `bulk_import` | File type, rows imported, rows skipped |
| `bulk_export` | File type, rows exported |
| `ai_classify` | Course title, result, model used |
| `metadata_fetch` | URL, result, source |
| `mark_verified` | Course ID, title |

**System events:**

| Action | Details Captured |
|---|---|
| `api_error` | Endpoint, error message, status code |
| `rate_limit_hit` | IP, endpoint, count |
| `ai_fallback` | From service, to service, reason |
| `notification_sent` | Type, recipient, success/failure |

### Device and Location Detection

Each log entry captures:

- **IP address** — from the request headers (Supabase forwards client IP).
- **IP country and city** — resolved from IP using a free IP geolocation lookup within the Edge Function.
- **Device type** — parsed from User-Agent string (Desktop, Mobile, Tablet).
- **Browser** — parsed from User-Agent (Chrome, Firefox, Safari, Edge, etc.).
- **Operating system** — parsed from User-Agent (Windows, macOS, iOS, Android, Linux).
- **Screen size** — captured from JavaScript `window.innerWidth × window.innerHeight` and sent with the request.
- **Referrer** — the page the user came from.
- **Session ID** — a unique identifier generated per browser session (stored in `sessionStorage`), grouping all actions from a single visit.

### Log Retention

- Logs are kept for **90 days** by default.
- A scheduled function (or manual process) deletes entries older than 90 days.
- Logs can be exported as CSV at any time from the admin dashboard.
- For longer retention, export logs periodically before the 90-day cutoff.

### Analytics Dashboard

The analytics dashboard in the admin panel presents the logged data in an actionable format.

**Overview cards:**
- Total active courses
- Pending / approved / rejected suggestions
- Searches today / this week / this month
- Course clicks today / this week / this month
- Unique sessions today

**Charts:**

| Chart | Type | Data Source |
|---|---|---|
| Searches over time | Line chart | `action='search'` grouped by day/week/month |
| Most searched terms | Horizontal bar chart (top 20) | `action='search'` → `details.query` |
| Most clicked courses | Horizontal bar chart (top 20) | `action='course_click'` → `details.course_id` |
| Most used filters | Pie chart | `action='filter_used'` → `details.filter` |
| Suggestions over time | Line chart | `action='suggestion'` grouped by day |
| Rating distribution | Histogram | All ratings, grouped by 1-5 stars |
| Traffic by device | Pie chart | `device_type` distribution |
| Traffic by country | Table (top 20) | `ip_country` distribution |
| Peak usage hours | Heatmap | Hour of day vs. day of week |

**Insights (auto-generated text):**
The analytics dashboard generates simple text insights based on the data:
- Most popular search terms and whether there are enough courses to satisfy demand.
- Percentage of users who filter for free courses (informs content strategy).
- Peak traffic hours (informs maintenance scheduling).
- Top-clicked courses (informs what is working well).
- Suggestion trends (informs whether the community is engaged).

---

## 13. Security & Privacy

### Authentication

- Admin authentication uses **Supabase Auth** with email/password.
- Passwords are hashed by Supabase using **bcrypt** (industry-standard, slow, salted).
- Tokens are **JWT (JSON Web Tokens)** with a 1-hour expiry.
- Tokens are stored in **sessionStorage** (cleared when the browser tab is closed; not accessible to other tabs or scripts).
- Failed login attempts are logged with IP, device, and browser info.
- After 5 failed login attempts from the same IP within 15 minutes, the IP is temporarily blocked (configurable).

### Input Sanitization

All user-submitted data is sanitized before storage and display:

**Server side (Edge Functions and RLS):**
- HTML tags stripped from all text fields.
- Special characters escaped: `< > " ' &`.
- URLs validated to ensure they start with `http://` or `https://`.
- Field length limits enforced (title: 200 chars, notes: 2,000 chars, etc.).
- `extra_fields` validated as proper JSON before storage.
- `difficulty`, `cost`, `certification`, `job_available`, `mode`, `format` are restricted to allowed values via CHECK constraints.

**Client side (Frontend):**
- All dynamic content rendered using `textContent` (never `innerHTML` with user data).
- Course titles, notes, and other text fields are HTML-escaped before display.
- Content Security Policy (CSP) header configured on GitHub Pages:

  ```
  Content-Security-Policy: default-src 'self';
    script-src 'self' https://unpkg.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src https://fonts.gstatic.com;
    connect-src https://YOUR_PROJECT_REF.supabase.co;
  ```

### Rate Limiting

| Endpoint | Limit | Window |
|---|---|---|
| `getCourses` (REST) | 60 requests | per minute per IP |
| `semanticSearch` | 20 requests | per minute per IP |
| `suggestCourse` | 5 submissions | per hour per IP |
| `submitRating` | 10 ratings | per hour per IP |
| `adminLogin` | 5 attempts | per 15 minutes per IP |
| All Edge Functions | 100 requests | per minute per IP |

When a limit is exceeded, the API returns:

```json
{
  "error": true,
  "message": "Too many requests. Please try again later.",
  "code": "RATE_LIMITED"
}
```

HTTP status code: `429 Too Many Requests`.

### CORS Policy

CORS is restricted to the frontend domain:

```
Access-Control-Allow-Origin: https://your-username.github.io
```

All other origins receive a CORS error. This prevents unauthorized websites from calling the API.

### Data Storage

- All data resides in **Supabase PostgreSQL** (hosted in the region you selected during project creation).
- **You own your data.** Supabase provides full database access and export capabilities.
- Supabase stores only vectors and course IDs in the embedding column — no third-party vector database is needed.
- Suggestion emails are stored only if the user provides them. Emails are used only for notification purposes and are never shared or used for marketing.

### API Key Security

- External API keys (Groq, Gemini, Resend) are stored as **Supabase Edge Function secrets** (encrypted environment variables). They are never exposed in frontend code or visible to anyone without project admin access.
- The Supabase **anon key** is safe to include in frontend code — it only allows operations permitted by RLS policies.
- The Supabase **service role key** is never included in frontend code. It is used only within Edge Functions.

### HTTPS

- GitHub Pages serves over HTTPS.
- Supabase serves over HTTPS.
- All API communication is encrypted in transit.

### Data Retention

- **Courses:** Permanent until manually archived or deleted by admin.
- **Suggestions:** Retained with their final status (pending/approved/rejected). Not deleted after review.
- **Ratings:** Permanent until manually deleted by admin.
- **Activity logs:** Retained for 90 days, then automatically deleted (configurable).
- **Authentication tokens:** Expire after 1 hour. Refresh tokens available for session extension.

### Spam Protection

Multi-layer protection on the public suggestion form:

| Layer | Mechanism | How It Works |
|---|---|---|
| 1. Honeypot | Hidden form field | A field invisible to humans but filled by bots. If filled, submission is silently rejected. |
| 2. Rate limiting | Per-IP limits | Maximum 5 suggestions per hour per IP. |
| 3. Content checks | Server-side validation | Rejects submissions with excessive links, all-caps titles, or titles shorter than 5 characters. |
| 4. Duplicate check | URL matching | Warns if a course with the same URL already exists. |
| 5. Admin review | Human approval | All suggestions require admin approval before becoming courses. |

---

## 14. Troubleshooting & Common Issues

| Issue | Likely Cause | Solution |
|---|---|---|
| Frontend shows "Loading courses..." forever | Supabase URL or anon key is incorrect in frontend code | Check `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `app.js`. Verify the Supabase project is active. |
| Admin login fails | Wrong email/password or Supabase Auth not configured | Verify the admin was invited through Supabase Auth. Check that Email provider is enabled. Reset password if needed. |
| "Failed to fetch" error on API calls | CORS misconfiguration or Supabase project paused | Verify the Edge Function `FRONTEND_URL` secret matches your GitHub Pages URL exactly. Check that the Supabase project is not paused (free tier pauses after 1 week of inactivity). |
| Auto-fetch metadata doesn't work | Mate.tools and OpenUnfurl both temporarily down | Fill in the fields manually. The feature is best-effort with two fallback APIs. |
| AI classification returns nothing | Groq and Gemini both failed or API keys invalid | Check that `GROQ_API_KEY` and `GEMINI_API_KEY` are set correctly in Edge Function secrets. Check Groq and Gemini dashboards for quota status. Wait and retry. |
| Semantic search returns empty or falls back to keyword | No courses have embeddings, or pgvector extension not enabled | Verify pgvector is enabled in Supabase (Database → Extensions). Add at least one course to generate an embedding. Check that the `embedding` column has data. |
| Email notifications not arriving | Resend API key invalid or daily limit reached | Check `RESEND_API_KEY` in Edge Function secrets. Check Resend dashboard for delivery status and daily usage (100/day limit). |
| Rate limit errors (429) | Too many requests from the same IP | Wait for the rate limit window to reset (1 minute for search, 1 hour for suggestions). If testing, use different IPs or wait between requests. |
| Supabase project paused | Free tier projects pause after 1 week of no activity | Go to Supabase dashboard and click "Restore project." Consider upgrading to Pro ($25/month) for always-on. Set up a cron job to ping the project weekly. |
| Slow first request | Edge Function cold start | Edge Functions take 1-3 seconds on first invocation after idle. Subsequent requests are fast. This is normal serverless behavior. |
| Embedding generation fails | Gemini API quota exceeded or model unavailable | Courses are still saved without embeddings. They will appear in keyword search but not semantic search. Retry embedding generation later or from the admin dashboard. |
| Bulk import fails midway | Rate limiting on AI services or invalid data in later rows | Check the import summary for which rows failed. Import in smaller batches. Ensure CSV/JSON data is valid before importing. |
| Duplicate rating error | Same IP already rated this course | This is expected behavior. One rating per IP per course. Clear browser data to test with a fresh session. |

### Deployment Checklist

After any update to Edge Functions or frontend code:

- [ ] Edge Functions redeployed (`supabase functions deploy <name>`)
- [ ] Edge Function secrets are set (`supabase secrets set KEY=VALUE`)
- [ ] Frontend files pushed to GitHub main branch
- [ ] GitHub Pages is serving the latest files (hard refresh: Ctrl+Shift+R)
- [ ] Supabase project is active (not paused)
- [ ] pgvector extension is enabled
- [ ] RLS policies are applied
- [ ] Admin account is created and can log in
- [ ] Test course can be added, searched, and rated
- [ ] Test suggestion can be submitted and triggers notification
- [ ] Activity log records actions

---

## 15. Performance & Scalability

### Current Scale Limits

| Resource | Limit | Impact |
|---|---|---|
| Database storage | 500MB (Supabase free) | ~80,000 courses with embeddings |
| Bandwidth | 5GB/month (Supabase free) | ~5,000-10,000 daily active users |
| Edge Function invocations | 500,000/month | ~16,000/day — sufficient for moderate traffic |
| Edge Function compute | 400,000 seconds/month | Generous for this workload |
| Groq API | 14,400 requests/day | AI classification calls only |
| Gemini API | 15 RPM, 1,500 RPD | Embeddings and fallback classification |
| Resend emails | 100/day | Notification emails only |

### Performance Characteristics

| Operation | Expected Time |
|---|---|
| Keyword search (REST API) | 50-200ms |
| Semantic search (Edge Function) | 500ms-2s (includes embedding generation) |
| Course save + embedding | 1-3s |
| Metadata extraction | 1-3s |
| AI classification | 2-5s |
| Email notification | 1-2s |
| Page load (first visit) | 1-3s (Edge Function cold start) |
| Page load (subsequent) | 100-300ms |

### Scaling Path

| Growth Stage | Courses | Users/Day | Action Needed |
|---|---|---|---|
| Launch | 0-500 | <100 | Nothing — free tier is more than enough |
| Growing | 500-5,000 | 100-1,000 | Monitor bandwidth and function invocations |
| Established | 5,000-50,000 | 1,000-5,000 | Consider Supabase Pro ($25/month) for higher limits |
| Large scale | 50,000+ | 5,000+ | Supabase Pro + optimize queries, add caching layer |

### Optimization Strategies

- **Database indexing:** All commonly queried columns have indexes. Full-text search uses a GIN index. Vector search uses an IVFFlat index.
- **Caching:** Frequently accessed data (course list, popular search results) can be cached using Supabase's built-in caching or a CDN layer.
- **Pagination:** All list endpoints are paginated. No endpoint returns all records at once.
- **Embedding efficiency:** Embeddings are generated once per course save and stored. Semantic search queries generate only one embedding (the query), not per-course embeddings.
- **Rate limiting:** Prevents abuse and ensures fair resource distribution.

---

## 16. Roadmap & Future Enhancements

### Version 2.1 (Planned Q3 2026)

- **Course comparison side-by-side** — select 2-3 courses and compare fields in a table view.
- **Course collections / playlists** — admins or users can group courses into themed collections (e.g., "Complete Python Learning Path").
- **Enhanced email templates** — HTML-formatted notification emails with branding.
- **Course link health checker** — automated periodic check of all course URLs. If a URL returns 404, the course is marked as "broken" and the admin is notified.
- **Dark mode** — toggle between light and dark themes on the public interface.

### Version 3.0 (Planned Q1 2027)

- **User accounts** (sign in with Google) — personal watchlists, rating history, suggestion tracking.
- **Personal watchlists** — logged-in users can save courses to a personal list.
- **Course reviews** — text-based reviews in addition to star ratings.
- **Automated course sync** — periodic sync with free course APIs (edX catalog, Coursera public courses).
- **Mobile app wrapper** (PWA) — installable progressive web app with offline support.

### Long-term

- **Multi-language support** — interface available in multiple languages.
- **Course provider dashboards** — institutions can claim their courses and view analytics.
- **AI-powered course recommendations** — personalized suggestions based on user browsing and rating history.
- **Migration to self-hosted** — option to run the entire stack on own infrastructure for complete control.

---

## 17. License & Acknowledgements

**License:** MIT — free to use, modify, and distribute.

**Built by:** Courseundo team (open source).

**Powered by:**

- **Supabase** — PostgreSQL database, Edge Functions, Authentication, pgvector
- **GitHub Pages** — Frontend hosting
- **Groq Cloud** — AI classification (Llama 3.3 70B)
- **Google AI Studio** — Gemini embeddings and fallback classification
- **Resend** — Email notifications
- **Mate.tools** — Metadata extraction (primary)
- **OpenUnfurl** — Metadata extraction (fallback)

**Contributions:** Issues and pull requests welcome on the GitHub repository. See CONTRIBUTING.md for guidelines (coming soon).

---

## 18. Appendices

### Appendix A: Example Course Record (JSON)

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "title": "Python for Data Science and Machine Learning",
  "link": "https://coursera.org/learn/python-data-science",
  "platform": "Coursera",
  "category": "Data Science",
  "institution": "IBM",
  "instructor": "Joseph Santarcangelo",
  "difficulty": "Beginner",
  "duration": "30 hours",
  "mode": "Self-paced",
  "format": "Video",
  "cost": "Free",
  "certification": "Yes",
  "cert_type": "Paid",
  "validation": "Industry badge",
  "job_available": "Yes",
  "job_country": "Remote, USA",
  "job_salary": "$70k-$95k",
  "job_mode": "Remote",
  "language": "English",
  "rating_avg": 4.2,
  "rating_count": 127,
  "extra_fields": {
    "projects": 5,
    "quizzes": 10,
    "prerequisite": "Basic Python"
  },
  "status": "active",
  "last_verified": "2026-06-01T12:00:00Z",
  "created_at": "2026-05-15T10:00:00Z",
  "updated_at": "2026-06-01T12:00:00Z"
}
```

### Appendix B: Example Suggestion Record (JSON)

```json
{
  "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "title": "Advanced Machine Learning Specialization",
  "link": "https://coursera.org/learn/advanced-ml",
  "platform": "Coursera",
  "notes": "Excellent deep dive into ML algorithms with hands-on projects",
  "user_name": "Jane Smith",
  "user_email": "jane@example.com",
  "status": "pending",
  "ip_address": "192.168.1.100",
  "device_info": {
    "device_type": "Desktop",
    "browser": "Chrome 125",
    "os": "macOS",
    "screen_size": "1920x1080"
  },
  "created_at": "2026-06-05T14:30:00Z",
  "reviewed_at": null,
  "reviewed_by": null
}
```

### Appendix C: Example Activity Log Entry (JSON)

```json
{
  "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "timestamp": "2026-06-05T14:30:00Z",
  "action": "search",
  "details": {
    "query": "python data science beginner",
    "results_count": 15,
    "search_type": "semantic",
    "filters_applied": {
      "cost": "Free",
      "difficulty": "Beginner"
    }
  },
  "ip_address": "192.168.1.100",
  "ip_country": "United States",
  "ip_city": "New York",
  "device_type": "Desktop",
  "browser": "Chrome 125",
  "os": "macOS",
  "screen_size": "1920x1080",
  "referrer": "https://google.com/search?q=python+courses",
  "session_id": "sess_abc123xyz"
}
```

### Appendix D: Dependency Version Reference

| Service | Version / Model | Status | Priority |
|---|---|---|---|
| Supabase | Latest (managed) | Active | Critical |
| PostgreSQL | 15.x (Supabase managed) | Active | Critical |
| pgvector | Latest (Supabase extension) | Active | Critical |
| Groq API | Model: `llama-3.3-70b-versatile` | Active | High |
| Gemini API | Model: `embedding-001` (768d) | Active | High |
| Gemini API | Model: `gemini-2.0-flash` (fallback) | Active | High |
| Mate.tools | Public API v1 | Active | Medium |
| OpenUnfurl | Public API | Active | Low (fallback) |
| Resend | API v1 | Active | Medium |

**Dependency management strategy:**

- **Critical dependencies** (Supabase, PostgreSQL, pgvector): Managed by Supabase. Version updates are automatic and tested.
- **High-priority dependencies** (Groq, Gemini): Pin to specific model names. Monitor for model deprecation announcements. Test fallback chain monthly.
- **Medium-priority dependencies** (Mate.tools, Resend): Have fallbacks or manual alternatives. Monitor for API changes.
- **Low-priority dependencies** (OpenUnfurl): Used only as fallback for metadata extraction. Manual entry is always available.

---

### Appendix E: Configuration Checklist

Use this checklist when deploying a new instance:

```
□ Supabase project created
□ Database schema executed (all tables, indexes, triggers, RLS policies)
□ pgvector extension enabled
□ Admin account created via Supabase Auth
□ Edge Functions deployed (all 6)
□ Edge Function secrets set:
    □ GROQ_API_KEY
    □ GEMINI_API_KEY
    □ RESEND_API_KEY
    □ ADMIN_EMAIL
    □ FRONTEND_URL
□ Frontend code updated with SUPABASE_URL and SUPABASE_ANON_KEY
□ GitHub Pages deployed and serving
□ CORS verified (only frontend domain allowed)
□ Test: Add a course (verify embedding generated)
□ Test: Keyword search works
□ Test: Semantic search works
□ Test: Suggestion submitted → admin notification received
□ Test: Rating submitted → average recalculated
□ Test: Activity log records actions
□ Test: Admin can archive and restore a course
□ Test: Bulk import works with sample CSV
□ Test: Analytics dashboard loads with data
□ Test: Rate limiting works (submit 6+ suggestions rapidly)
□ Test: Honeypot spam protection works
□ Documentation updated with instance-specific URLs
```

---

**End of Documentation**

For support, open an issue on the GitHub repository or contact the admin via the email configured in your deployment.