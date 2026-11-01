# muse.log - Blog with Chat and Admin Panel

A modern, cost-optimized blog platform built with Next.js, featuring:
- 3-level category hierarchy
- Blog chat that answers from the posts themselves (OpenAI)
- Full-featured admin panel
- "Deep Sea" themed UI
- Zero-cost convergence architecture

## 🎨 Features

### Public Blog
- ✅ 3-level category tree (collapsible)
- ✅ Category filtering pages (`/category/[slug]`)
- ✅ Blog post listing with ISR caching
- ✅ Table of Contents with scroll spy navigation
- ✅ Breadcrumb navigation (clickable hierarchy)
- ✅ 3-column responsive layout
- ✅ Chat for Q&A about blog content (picks up to 3 posts from the post index and reads them in full)
- ✅ Dark/Light mode support
- ✅ Responsive "Deep Sea" theme

### Admin Panel
- ✅ Dashboard with statistics
- ✅ Post management (create, read, edit, delete)
  - ✅ Create: `/admin/posts/new`
  - ✅ Edit: `/admin/posts/[slug]/edit` (slug-based URL)
  - ✅ Slug immutability (cannot be changed after creation)
- ✅ Markdown editor (react-md-editor)
- ✅ Category management (3-level hierarchy)
- ✅ Media library (image upload to Supabase Storage)
- ✅ Protected routes with middleware

## 🏗️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI (gpt-4o-mini)
- **Deployment**: Vercel (Serverless)
- **Storage**: Supabase Storage
- **Auth**: Supabase Auth

## 📦 Project Structure

```
muse-log/
├── src/
│   ├── app/
│   │   ├── admin/              # Admin panel pages
│   │   │   ├── layout.tsx      # Admin layout
│   │   │   ├── page.tsx        # Dashboard
│   │   │   ├── posts/
│   │   │   │   ├── new/        # Create post
│   │   │   │   └── [slug]/
│   │   │   │       ├── edit/   # Edit post (Server + Client)
│   │   │   │       │   ├── page.tsx
│   │   │   │       │   └── EditPostForm.tsx
│   │   │   │       └── delete/ # Delete post
│   │   │   ├── categories/     # Category management
│   │   │   ├── media/          # Media library
│   │   │   └── settings/       # Blog settings
│   │   ├── api/                # API routes
│   │   │   ├── posts/          # Posts CRUD
│   │   │   ├── categories/     # Categories CRUD
│   │   │   ├── media/          # Media upload/delete
│   │   │   ├── chat/           # Blog chat (index routing)
│   │   │   └── admin/stats/    # Dashboard stats
│   │   ├── category/[slug]/    # Category filter pages
│   │   ├── posts/[slug]/       # Individual post pages
│   │   ├── login/              # Login page
│   │   └── page.tsx            # Public homepage
│   ├── components/
│   │   ├── admin/              # Admin components
│   │   │   ├── AdminNav.tsx
│   │   │   └── ...
│   │   ├── Breadcrumb.tsx      # Hierarchical navigation
│   │   ├── CategoryInfo.tsx    # Category sidebar
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── PostCard.tsx        # Post preview card
│   │   ├── Sidebar.tsx         # Category tree
│   │   ├── TableOfContents.tsx # Scroll spy TOC
│   │   └── ...
│   ├── hooks/
│   │   ├── useLocalStorage.ts  # SSR-safe localStorage hook
│   │   └── useScrollSpy.ts     # Scroll spy for TOC
│   ├── lib/
│   │   ├── chat/               # Blog chat (router, answer, cache)
│   │   ├── constants.ts        # Cache durations, storage keys
│   │   ├── supabase.ts         # Client-side Supabase
│   │   ├── supabase-server.ts  # Server-side Supabase
│   │   └── utils/
│   │       └── category.ts     # Category tree utilities
│   ├── types/
│   │   ├── category.ts         # Category, Breadcrumb, TOC types
│   │   └── database.ts         # Database types
│   └── middleware.ts           # Auth middleware
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Database schema
├── description.md              # Architecture documentation
└── CLAUDE.md                   # Multi-agent system constitution
```

## 🚀 Getting Started

### 1. Prerequisites

- Node.js 18+
- Supabase account
- OpenAI API key

### 2. Installation

```bash
# Clone repository
git clone <your-repo-url>
cd muse-log

# Install dependencies
npm install
```

### 3. Environment Variables

Create `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Admin
NEXT_PUBLIC_ADMIN_EMAIL=your-admin-email@example.com

# OpenAI
OPENAI_API_KEY=sk-proj-your-key

# On-demand revalidation for brain publishing (32+ bytes, also set in Vercel)
REVALIDATE_SECRET=random-hex-string
```

See `.env.local.example` for the full list. Brain publishing keys go in a separate file (see [brain 발행](#brain-발행)).

### 4. Database Setup

1. Create a new Supabase project
2. Run the migration:

```bash
# Copy the contents of supabase/migrations/001_initial_schema.sql
# Paste into Supabase SQL Editor and run
```

3. Configure admin email in Supabase:
   - Go to Settings > API > Custom PostgreSQL configuration
   - Add: `app.admin_email = 'your-admin-email@example.com'`

### 5. Run Development Server

```bash
npm run dev
```

Visit:
- Public blog: `http://localhost:3000`
- Admin panel: `http://localhost:3000/admin`
- Login: `http://localhost:3000/login`

## 📚 Key Concepts

### Database Schema

See `description.md` for detailed explanation of:
- Posts, Categories, Media tables
- 3-level category hierarchy
- RLS (Row Level Security) policies

### Page Layout (3-Column Design)

Post and category pages use a responsive 3-column layout:

```
┌──────────────┬───────────────────────┬──────────────┐
│   Sidebar    │    Main Content       │  Right Panel │
│  (Category   │    (55% width)        │   (TOC or    │
│    Tree)     │                       │ Category Info)│
│  Collapsible │  Post/Category List   │  Collapsible │
└──────────────┴───────────────────────┴──────────────┘
```

- **Left Sidebar**: Category tree with expand/collapse
- **Main Content**: Post content or category post list
- **Right Sidebar**:
  - Post page: Table of Contents with scroll spy
  - Category page: Category description and subcategories

### Navigation Features

**Breadcrumb Navigation**:
- Shows hierarchical path (Home > IT > Backend > Node.js)
- All parent categories are clickable links
- Current page shown without link
- Fully accessible with ARIA labels

**Table of Contents**:
- Auto-extracts H2 and H3 headings from markdown
- Scroll spy highlights active section
- Smooth scroll to section on click
- Collapse state persisted in localStorage

### Caching Strategy

- **Posts list**: ISR with 1-hour revalidation
- **Individual posts**: ISR with 24-hour revalidation
- **Categories**: ISR with 24-hour revalidation (includes static generation at build time)
- **Category tree**: Client-side cache (1 hour in localStorage)
- **Images**: Immutable cache (1 year)

### Blog chat

1. A router call reads a text index of public posts (`blog_index`) plus recently read slugs and the last turns, and picks up to 3 slugs
2. The server keeps only slugs in the index and reads those posts in full
3. An answer call (default `gpt-4o-mini`, `CHAT_MODEL`) answers from those posts; `sources` lists the posts actually read
4. First-turn answers are cached 24h (tag `blog-chat`, purged on publish and post writes); `CHAT_DISABLED=1` turns the chat off

**Cost**: about $0.002 per question (two LLM calls), capped by a prepaid OpenAI balance

### Cost Optimization

This project follows a **zero-cost convergence** principle:

```
lim(cost) → $2/month as traffic → moderate
```

- Static-first rendering (ISR)
- Minimal OpenAI API calls
- Supabase free tier (500MB DB, 1GB Storage)
- Vercel free tier
- No paid SaaS dependencies

## 🔒 Security

- RLS policies protect all database tables
- Middleware protects `/admin` routes
- Admin email verification
- Supabase Auth for session management

## 🎨 Customization

### Theme

The "Deep Sea" theme uses CSS variables:

```css
/* Light Mode */
--color-primary: #0c8bc9 (Ocean Blue)
--bg-primary: #f8fafc
--text-primary: #1e293b

/* Dark Mode */
--color-primary: #14a2e0
--bg-primary: #020715 (Deep Sea)
--text-primary: #e2e8f0
```

Edit `src/app/globals.css` to customize.

### Categories

Default 3-level structure:
```
IT (Level 1)
├── Backend (Level 2)
│   ├── Node.js (Level 3)
│   └── Python (Level 3)
└── Frontend (Level 2)
    ├── React (Level 3)
    └── Vue (Level 3)
```

Manage via Admin Panel → Categories.

## 📖 Documentation

- **Architecture**: See `description.md`
- **Multi-Agent System**: See `CLAUDE.md`
- **API Reference**: See inline comments in `/src/app/api/*`

## 🚢 Deployment

### Vercel

1. Push to GitHub
2. Import project to Vercel
3. Add environment variables
4. Deploy

### Post-Deployment

1. Set up Supabase custom config (admin email)
2. Create admin user in Supabase Auth
3. Test login at `/login`
4. Access admin at `/admin`

## 📝 Usage

### Creating Posts

1. Go to `/admin/posts/new`
2. Write title, content (Markdown), excerpt
3. Select category
4. Check "Publish immediately" or save as draft

### Editing Posts

1. Go to `/admin/posts`
2. Click on a post to edit (or navigate to `/admin/posts/[slug]/edit`)
3. Update title, content, category, or excerpt
4. Note: Slug cannot be changed (to preserve URL integrity)
5. Save changes
6. Saving purges the chat cache, so the chat reads the updated post
7. Brain-origin posts (`origin: 'brain'`): only category and tags can be changed in admin; title, content, excerpt, published and delete are locked (API returns 409). Edit them in the brain vault

### Deleting Posts

1. Go to `/admin/posts`
2. Click delete button on a post
3. Confirms deletion
4. Saving purges the chat cache, so the chat no longer cites the deleted post

### Managing Categories

1. Go to `/admin/categories`
2. Create categories at appropriate levels (1, 2, or 3)
3. Categories display as tree in sidebar

### Uploading Media

1. Go to `/admin/media`
2. Click "Upload Image"
3. Copy URL to use in posts

Images under `brain/` are managed by the publish script and cannot be deleted from admin.

### brain 발행

Publishes posts written in the brain Obsidian vault (`brain/blog/*.md` with `publish: true`) straight to Supabase, without a git push or rebuild. Design: `docs/design/brain-publish.md`. Requires migration `006_brain_publish.sql` (applied to production on 2026-10-29).

Create `.env.brain.local` (gitignored, never loaded by Next.js; `NEXT_PUBLIC_SUPABASE_URL` is read from `.env.local`):

```env
SUPABASE_SERVICE_ROLE_KEY=service-role-key   # never put in Vercel
SITE_URL=https://your-blog-domain
REVALIDATE_SECRET=same-value-as-vercel       # must match REVALIDATE_SECRET in Vercel
```

```bash
# Publish (dry-run by default: validates and prints the plan, writes nothing)
node scripts/brain-publish.mjs --brain D:/workspace/brain
node scripts/brain-publish.mjs --brain D:/workspace/brain --apply   # upload images, write DB, revalidate
node scripts/brain-publish.mjs --revalidate-only                    # retry revalidation only

# One-off migration of existing posts into the vault
node scripts/brain-export.mjs --brain D:/workspace/brain [--apply]
```

Exit codes: `0` success, `1` validation violation / export verification diff / runtime error (nothing is written on a violation), `2` usage error or missing env key. Writes are idempotent, so re-run after fixing the cause.

Brain-origin posts are body-locked in admin: only category and tags can be edited there.

## 🤝 Contributing

This is a personal project, but suggestions are welcome!

## 📄 License

MIT

## 🙏 Credits

Built with:
- Next.js
- Supabase
- OpenAI
- react-md-editor

---

**Note**: This project was built following the CLAUDE.md multi-agent system constitution to ensure quality, security, and cost optimization.
