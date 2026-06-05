# **Courseundo – Complete Platform Documentation**

Version 1.0 | Last Updated: June 2026  
Website: `https://yourusername.github.io/courseundo`  
Backend API: Google Apps Script (deployment URL)

---

## **Table of Contents**

1. Platform Overview  
2. Architecture & Technology Stack  
3. Features  
4. Setup & Installation Guide  
5. User Guide – Public Interface  
6. User Guide – Admin Dashboard  
7. API Reference  
8. Data Schema  
9. AI Integration Details  
10. Troubleshooting & Common Issues  
11. Security & Privacy  
12. Roadmap & Future Enhancements  
13. License & Acknowledgements

---

## **1\. Platform Overview**

Courseundo is a free, open‑source platform for discovering, organizing, and sharing online courses. It combines:

* Public search with keyword filters and AI‑powered semantic search.  
* Admin dashboard for adding, editing, and managing courses with automatic metadata extraction and AI classification.  
* Crowdsourcing – any user can suggest courses, which admins can approve.

The entire system runs on zero‑cost services: GitHub Pages (frontend), Google Apps Script (backend API), Google Sheets (database), and free tiers of Groq, Gemini, and Pinecone for AI.

---

## **2\. Architecture & Technology Stack**

`text`

`┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐`  
`│  GitHub Pages   │────▶│  Google Apps     │────▶│  Google Sheets  │`  
`│  (static HTML,  │ API  │  Script (REST)   │      │  - courses      │`  
`│   CSS, JS)      │◀────│  - Authentication │      │  - suggestions  │`  
`└─────────────────┘     │  - CRUD ops       │      └─────────────────┘`  
        `│                │  - AI fallbacks   │               │`  
        `│                └────────┬─────────┘               │`  
        `│                         │                         │`  
        `▼                         ▼                         ▼`  
`┌─────────────────────────────────────────────────────────────────┐`  
`│                    External Free Services                       │`  
`│  • Groq (LLM classification)        • Pinecone (vector DB)      │`  
`│  • Gemini (embeddings + fallback)    • Mate.tools (metadata)    │`

`└─────────────────────────────────────────────────────────────────┘`

| Component | Technology | Free Tier Limits |
| :---- | :---- | :---- |
| Frontend hosting | GitHub Pages | Unlimited static hosting |
| Backend API | Google Apps Script | 20k requests/day (free) |
| Database | Google Sheets | 15 GB storage, 500 cells/sheet |
| AI classification | Groq (primary) | 14,400 requests/day |
| AI fallback | Gemini | 15 RPM, 1.5k RPD |
| Embeddings | Gemini | Included with Gemini free tier |
| Vector search | Pinecone | 100k vectors, 2GB storage |
| Metadata extraction | [Mate.tools](https://mate.tools/) / OpenUnfurl | No rate limits (public API) |

---

## **3\. Features**

### **Public Interface**

* 🔍 Keyword search (title, platform, institution, instructor)  
* 🧠 AI semantic search – natural language queries like *"beginner Python with job placement in Europe"*  
* 📊 Filter by platform, category, certification, job availability, difficulty, cost  
* 💡 Course suggestion form – anyone can recommend a course  
* 📄 Responsive card layout with badges and key info  
* 🔗 Direct link to course URL

### **Admin Dashboard (password‑protected)**

* ➕ Add new courses with all optional fields  
* ✏️ Edit / delete existing courses  
* 🤖 Auto‑fetch metadata from course URL (title, platform, description)  
* 🧠 AI classification – automatically suggests category, difficulty, duration, job relevance  
* ✅ Approve / reject public suggestions (auto‑fill form from suggestion)  
* 📋 View all courses in a list with quick actions

### **Backend API**

* REST endpoints for courses, suggestions, semantic search  
* Admin authentication with temporary token  
* Auto‑sync to Pinecone vector index for semantic search

### **Data Model**

* Flexible schema: 22 core fields \+ `extra_fields` JSON column for any additional attributes  
* Optional fields – only filled values are stored, empty fields are ignored

---

## **4\. Setup & Installation Guide**

### **Prerequisites**

* A Google account (for Sheets & Apps Script)  
* A GitHub account (for hosting)  
* API keys (free):  
  * [Groq](https://console.groq.com/) – sign up, get API key  
  * [Gemini](https://aistudio.google.com/apikey) – enable API  
  * [Pinecone](https://www.pinecone.io/) – create free account, index named `courseundo`

### **Step 1: Create Google Sheet & Apps Script**

1. Create a new Google Sheet – name it `Courseundo Data`  
2. Open Extensions → Apps Script  
3. Delete default code and paste the entire `Code.gs` (from provided file)  
4. In `Code.gs`, replace:  
   * `YOUR_GROQ_API_KEY`  
   * `YOUR_GEMINI_API_KEY`  
   * `PINECONE_API_KEY`  
   * `ADMIN_PASSWORD_HASH` (generate SHA256 of your chosen password – use online tool)  
5. Save the project (name it `Courseundo API`)  
6. Click Deploy → New deployment → Type: Web app  
   * Execute as: Me  
   * Who has access: Anyone (the frontend will call it)  
7. Click Deploy and Authorize when prompted  
8. Copy the Web App URL – it will look like `https://script.google.com/macros/s/.../exec`

### **Step 2: Deploy Frontend to GitHub Pages**

1. Create a new public GitHub repository named `courseundo`  
2. Upload the three files:  
   * `index.html`  
   * `admin.html`  
   * `README.md` (optional)  
3. In both `index.html` and `admin.html`, find `const API_BASE = ...` and replace with your Apps Script URL  
4. Go to repository Settings → Pages  
   * Source: `Deploy from a branch`  
   * Branch: `main`, folder: `/ (root)`  
   * Save  
5. After 1‑2 minutes, your site is live at:  
   `https://your-username.github.io/courseundo`

### **Step 3: Create Pinecone Index**

1. Log into [Pinecone](https://www.pinecone.io/)  
2. Click Create Index → Name: `courseundo`  
   Dimensions: `768` (Gemini embedding model)  
   Metric: `cosine`  
   Environment: `gcp-starter` (free tier)  
3. Copy your API key and environment name into `Code.gs`

### **Step 4: Verify Installation**

* Visit the public URL – you should see the search interface.  
* Visit `/admin.html` – login with your password.  
* Try adding a course with Auto‑fetch and AI Classify.  
* Test public search and suggestion form.

---

## **5\. User Guide – Public Interface**

### **Access**

URL: `https://your-username.github.io/courseundo`

### **Searching Courses**

Keyword Search  
Type words into the search bar and press Enter or click 🔍.  
Searches: title, platform, institution, instructor, and extra fields.

AI Semantic Search  
Enter a natural language query (e.g., *"machine learning with free certificate and job help"*) – the system uses embeddings to find conceptually related courses, not just keyword matches.

Filters  
Use the dropdown filters below the search bar to refine by:

* Platform (e.g., Coursera, edX)  
* Category (Programming, Data Science, etc.)  
* Certification (Yes/No)  
* Job availability  
* Difficulty (Beginner/Intermediate/Advanced)  
* Cost (Free/Paid/Subscription)

Pagination – 12 courses per page, click page numbers at bottom.

### **Suggesting a Course**

Click the 💡 Suggest a Course tab. Fill in:

* Course Title (required)  
* Course URL (required)  
* Platform (optional)  
* Your notes / reason for recommendation (optional)  
* Your email (optional – to get notified when approved)

Click Submit Suggestion – the suggestion is sent to the admin for review.

### **Course Card Information**

Each card shows:

* Title (clickable link to course)  
* Platform badge, category badge, certification badge, difficulty, cost  
* Institution, instructor, duration (if provided)  
* Job availability badge

---

## **6\. User Guide – Admin Dashboard**

### **Access & Login**

URL: `https://your-username.github.io/courseundo/admin.html`  
Enter the password you set during installation.  
Session lasts 1 hour.

### **Tabs**

#### Courses Tab

Add / Edit Course  
Fill any of the 22 fields (only title and link are required).  
All other fields can be left empty – they won’t appear in search results.

AI‑Assisted Fields

* Auto‑fetch Metadata – click after entering URL; fetches title and platform from the course page using free APIs.  
* AI Classify (Groq) – automatically suggests category, difficulty, duration estimate, and job relevance. Falls back to Gemini if Groq fails.

Extra Fields (JSON)  
For data not covered by standard fields, add JSON like:  
`{"prerequisite": "Basic Python", "projects": 3, "language_subtitles": ["Spanish","French"]}`

Save Course – creates new or updates existing course.  
Clear – resets the form.  
Edit – click on any course in the list to load its data.  
Delete – removes course and its vector from Pinecone.

#### Suggestions Tab

Lists all pending course suggestions from public users.  
Each suggestion shows: title, URL, platform, notes, submitter email, timestamp.

Actions:

* Approve & Add – pre‑fills the course form with suggestion data. You can edit before saving. After saving, the suggestion is automatically deleted.  
* Reject – discards the suggestion.

### **Bulk Operations**

Currently not available – use Google Sheet directly for bulk import/export.

---

## **7\. API Reference**

All endpoints are accessed via your Apps Script Web App URL (`BASE_URL`).

### **Public Endpoints (no authentication)**

#### `GET ?action=getCourses`

Returns all courses as JSON array.

Example:  
`GET https://script.google.com/.../exec?action=getCourses`

Response:

`json`

`{`  
  `"courses": [`  
    `{ "id": "...", "title": "...", "link": "...", ... }`  
  `]`

`}`

#### `GET ?action=semanticSearch&q=<query>`

Returns courses ranked by semantic similarity to the query.

Example:  
`GET .../exec?action=semanticSearch&q=data%20science%20beginner`

Response:

`json`

`{`  
  `"results": [ ... array of course objects ... ]`

`}`

#### `POST ?action=suggestCourse`

Submit a new course suggestion.

Body (JSON):

`json`

`{`  
  `"title": "Course Title",`  
  `"link": "https://...",`  
  `"platform": "Coursera",`  
  `"notes": "Great for beginners",`  
  `"email": "user@example.com"`

`}`

Response: `{ "status": "ok", "id": "suggestion-id" }`

### **Admin Endpoints (require `?admin=true` \+ Bearer token)**

All admin endpoints must include `Authorization: Bearer <token>` header.  
Token is obtained via `adminLogin`.

#### `POST ?action=adminLogin`

Body: `{ "password": "yourpassword" }`  
Response: `{ "token": "uuid-token" }`

#### `POST ?action=saveCourse`

Body: course object (with or without `id`).  
Response: `{ "status": "saved", "id": "course-id" }`

#### `POST ?action=deleteCourse`

Body: `{ "id": "course-id" }`  
Response: `{ "status": "deleted" }`

#### `GET ?action=getSuggestions`

Response: `{ "suggestions": [ ... ] }`

#### `POST ?action=deleteSuggestion`

Body: `{ "id": "suggestion-id" }`  
Response: `{ "status": "deleted" }`

---

## **8\. Data Schema**

### **Courses Sheet (columns)**

| Column | Type | Description |
| :---- | :---- | :---- |
| `id` | string | UUID, primary key |
| `title` | string | Course name (required) |
| `link` | string | Course URL (required) |
| `platform` | string | e.g., Coursera, Udemy |
| `category` | string | e.g., Programming, Data Science |
| `institution` | string | University or company |
| `instructor` | string | Lead instructor(s) |
| `difficulty` | string | Beginner/Intermediate/Advanced |
| `duration` | string | e.g., 40 hours, 6 weeks |
| `mode` | string | Self-paced, Instructor-led |
| `format` | string | Video, Text, Interactive |
| `cost` | string | Free, Paid, Subscription |
| `certification` | string | Yes/No |
| `certification_type` | string | Paid certificate, Free, Verified |
| `validation` | string | Accredited, Industry badge |
| `job_availability` | string | Yes/No |
| `job_country` | string | e.g., USA, India, Remote |
| `job_salary_range` | string | e.g., $60k–$90k |
| `job_mode` | string | Remote, On-site, Hybrid |
| `language` | string | Course language |
| `rating` | number | 0–5 |
| `extra_fields` | JSON | Any additional structured data |
| `timestamp` | datetime | ISO 8601 |

### **Suggestions Sheet (columns)**

| Column | Type | Description |
| :---- | :---- | :---- |
| `id` | string | UUID |
| `title` | string | Suggested course title |
| `link` | string | Suggested URL |
| `platform` | string | Platform (optional) |
| `notes` | string | User comments |
| `email` | string | Submitter email (optional) |
| `status` | string | pending / approved / rejected |
| `timestamp` | datetime | Submission time |

---

## **9\. AI Integration Details**

### **Metadata Extraction**

* Uses two free public APIs with automatic fallback: [Mate.tools](https://mate.tools/) (POST) and OpenUnfurl (GET).  
* If both fail, admin enters manually.  
* Extracts: `title`, `siteName` (platform), `description` (stored in extra\_fields if needed).

### **AI Classification**

Primary: Groq (Llama 3.3 70B) – fast, high capacity.  
Fallback: Gemini 2.0 Flash – used if Groq fails or quota exceeded.

Prompt example:

`text`

`Classify this course. Title: Python for Data Science. Description: ...`

`Return JSON: {"category":"...", "difficulty":"...", "duration":"...", "job_relevance":"..."}`

The admin button triggers this; suggested values are populated into the form but can be overridden.

### **Semantic Search Pipeline**

1. User enters query.  
2. Frontend calls `?action=semanticSearch&q=...`  
3. Apps Script:  
   * Generates embedding of query using Gemini `embedding-001` model (768 dimensions).  
   * Queries Pinecone index for top 20 vectors by cosine similarity.  
   * Fetches full course objects from Google Sheets.  
   * Returns ranked results.  
4. If Pinecone or Gemini fails, falls back to keyword search (client‑side or server‑side).

### **Embedding Sync**

Whenever a course is saved (created or updated), Apps Script generates a new embedding and upserts it to Pinecone. On deletion, the vector is removed.

Limitation: Pinecone free tier supports 100k vectors – enough for \~10,000 courses. For larger datasets, upgrade or migrate to self‑hosted vector DB.

---

## **10\. Troubleshooting & Common Issues**

| Issue | Likely Cause | Solution |
| :---- | :---- | :---- |
| Frontend shows "Loading courses..." forever | Apps Script URL incorrect or not deployed | Check `API_BASE` in HTML files; redeploy Apps Script |
| Admin login fails | Wrong password or hash mismatch | Re‑compute SHA256 of your password and update `ADMIN_PASSWORD_HASH` in `Code.gs`; redeploy |
| Auto‑fetch metadata doesn't work | Public APIs temporarily down | Fill manually; the feature is best‑effort |
| AI classification returns nothing | Groq or Gemini quota exceeded or API key invalid | Check API keys; Gemini free tier limits 15 RPM – wait a minute and retry |
| Semantic search returns empty or error | Pinecone index not created or no vectors | Verify index name `courseundo` with dimension 768; add at least one course to create vectors |
| URLFetchApp "Bandwidth quota exceeded" | Too many API calls from Apps Script | Move AI calls to client side (already done for classification). Semantic search uses only embedding call which is lightweight. |
| Google Sheets becomes slow after many rows | 1000+ rows | Consider archiving old courses or migrating to BigQuery (free tier available) |

Deployment checks:

* After updating `Code.gs`, you must create a new deployment (or update existing) – changes are not live until redeployed.  
* GitHub Pages may cache old files – do a hard refresh (Ctrl+Shift+R).

---

## **11\. Security & Privacy**

### **Authentication**

* Admin uses a single password, hashed with SHA256 in Apps Script.  
* Token stored in Apps Script cache (expires after 1 hour).  
* No user accounts – only one global admin.

### **Data Storage**

* All data resides in your Google Sheet (you own it).  
* No third‑party database – Pinecone stores only vectors and course IDs (no full text).  
* Suggestions include email only if user provides it; emails are not used for marketing.

### **API Keys**

* Store keys directly in `Code.gs` (visible to anyone with edit access to Apps Script). For production, use Script Properties (Environment Variables) to hide keys.  
* Groq and Gemini keys are limited to their free tier – misuse can't exceed quotas.

### **HTTPS & CORS**

* GitHub Pages and Apps Script both serve over HTTPS.  
* Apps Script automatically allows CORS from any origin (no additional config).

### **Data Retention**

* Courses are permanent until manually deleted.  
* Suggestions are deleted after approval or rejection.

---

## **12\. Roadmap & Future Enhancements**

### **Version 1.1 (planned Q3 2026\)**

* Bulk import from CSV/JSON via admin  
* User ratings (upvote/downvote) for courses  
* Export dataset as CSV from admin dashboard  
* Email notifications for suggestion approval (using free email service like Resend)

### **Version 2.0 (planned Q1 2027\)**

* User accounts (sign in with Google) – limited free tier  
* Personal watchlists – users save courses  
* Course comparison side‑by‑side  
* Automated weekly sync with external course APIs (free edX, Coursera catalogs)

### **Long‑term**

* Migration to Cloudflare Workers \+ D1 for better scalability (still free)  
* Mobile app wrapper (PWA)

---

## **13\. License & Acknowledgements**

License: MIT – free to use, modify, and distribute.  
Built by: Courseundo team (open source)  
Powered by:

* Google Apps Script & Sheets  
* GitHub Pages  
* Groq Cloud  
* Google AI Studio (Gemini)  
* Pinecone  
* [Mate.tools](https://mate.tools/) & OpenUnfurl

Contributions: Issues and pull requests welcome on the GitHub repository.

---

## **Appendix A: Sample Admin Password SHA256**

Default password `password` has SHA256:  
`5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8`  
Change immediately using any online SHA256 generator.

---

## **Appendix B: Example Course Record (JSON)**

`json`

`{`  
  `"id": "abc123",`  
  `"title": "Python for Data Science and Machine Learning",`  
  `"link": "https://coursera.org/learn/python-data-science",`  
  `"platform": "Coursera",`  
  `"category": "Data Science",`  
  `"institution": "IBM",`  
  `"instructor": "Joseph Santarcangelo",`  
  `"difficulty": "Beginner",`  
  `"duration": "30 hours",`  
  `"mode": "Self-paced",`  
  `"format": "Video",`  
  `"cost": "Free",`  
  `"certification": "Yes",`  
  `"certification_type": "Paid",`  
  `"validation": "Industry badge",`  
  `"job_availability": "Yes",`  
  `"job_country": "Remote, USA",`  
  `"job_salary_range": "$70k–$95k",`  
  `"job_mode": "Remote",`  
  `"language": "English",`  
  `"rating": 4.8,`  
  `"extra_fields": {`  
    `"projects": 5,`  
    `"quizzes": 10,`  
    `"prerequisite": "Basic Python"`  
  `},`  
  `"timestamp": "2026-06-04T12:00:00Z"`

`}`

---

End of Documentation

For support, open an issue on GitHub or contact the admin via email (configured in your deployment).  
