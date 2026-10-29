# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added

- **Brain vault publishing (roadmap ②)** - see `docs/design/brain-publish.md`
  - `scripts/brain-publish.mjs`: validates `brain/blog/*.md` (`publish: true`) and upserts posts, tags, images, `post_sources`, `post_links`. Dry-run by default, `--apply` to write, `--revalidate-only` to retry revalidation
  - `scripts/brain-export.mjs`: one-off migration of existing posts into the vault (dry-run / `--apply`)
  - `POST /api/revalidate`: Bearer `REVALIDATE_SECRET` (32+ bytes), revalidates `/` (layout), `/api/posts`, `/api/tags`, `/api/tags/graph`
  - Migration `006_brain_publish.sql`: `posts.origin` (`admin` | `brain`), `post_sources`, `post_links`, `blog_index` view, `guard_brain_posts` trigger, `brain/` storage policies. Applied to production on 2026-10-29
  - `BRAIN_STORAGE_PREFIX` (`brain/`) in `src/lib/constants.ts`; `yaml` dev dependency
  - Script tests under `scripts/lib/*.test.mjs` (`node --test`)

- **D3.js Force Simulation Integration**
  - Implemented physics-based node positioning using D3.js force simulation
  - Components and Hooks:
    - `useD3ForceSimulation.ts`: Custom React hook for D3 force simulation with RAF throttling
    - Updated `NeuralNetwork.tsx`: Replaced static positioning with D3-driven coordinates
    - Updated `NetworkNode.tsx`: Removed Framer Motion position animations, using CSS transforms
    - Updated `neural-graph-builder.ts`: Added dynamic node size calculation based on label length
  - Physics Forces:
    - `forceLink`: Depth-based link distances (120/100/80px)
    - `forceManyBody`: Depth-based repulsion strength (-600/-300/-150)
    - `forceCollide`: Collision detection using calculated node radius
    - `forceRadial`: Depth-1 nodes arranged in 280px radius circle
    - `forceCenter`: Weak centering force (0.03 strength)
  - Performance Optimizations:
    - RequestAnimationFrame throttling for 60fps smooth updates
    - React.memo with custom comparison for NetworkNode (1px threshold)
    - Framer Motion limited to scale/opacity only (no position animations)
    - D3 handles physics, React handles rendering (clear separation of concerns)
  - Node Size Calculation:
    - Depth-based font sizes (13px/11px/10px) and character widths
    - Dynamic width/height with min/max constraints
    - Collision radius calculated from diagonal + margin

- **Neural Network Homepage UI** (Desktop)
  - Complete redesign of main page with interactive neural network visualization
  - Components:
    - `NeuralNetwork.tsx`: SVG-based graph rendering with node-edge connections
    - `NetworkNode.tsx`: Animated category/subcategory/post nodes with hover effects
    - `CenterCard.tsx`: Floating chat interface with RAG integration
    - `ChatBubble.tsx`: Typing animation for AI responses
    - `PostModal.tsx`: Full-screen post viewer with backdrop blur
    - `NeuralHomePage.tsx`: Main orchestrator component
  - Features:
    - Real-time category/post network graph with ambient pulse animations
    - Edge detection for expanding categories on screen edges
    - Click-to-activate "night view" effect (dim non-active categories)
    - RAG chatbot highlights related posts in the network
    - ISR-based data fetching (1-hour revalidation)
    - Framer Motion animations throughout
  - Design System:
    - Cyberpunk-inspired color palette (cyan #00FFC8, purple #A78BFA)
    - Space Grotesk + IBM Plex Mono fonts
    - Deep dark background (#080B10) with neural glow effects
    - Backdrop blur + glassmorphism for center card

- **Neural Graph Data Builder** (`lib/neural-graph-builder.ts`)
  - Converts category tree + posts to positioned node graph
  - Circular layout algorithm for radial distribution
  - Hierarchical positioning (category → subcategory → posts)
  - Node type mapping (category/subcategory/post)
  - Helper functions for graph traversal and node lookup

- **Category filtering pages** (`/category/[slug]`)
  - Displays posts from a category and its descendants
  - Shows category description and subcategories in right sidebar
  - ISR with 1-hour revalidation
  - Static generation for all categories at build time

- **Table of Contents component** (`TableOfContents.tsx`)
  - Automatically extracts H2 and H3 headings from markdown
  - Scroll spy highlighting for active section
  - Collapsible UI with localStorage persistence
  - Smooth scroll navigation

- **Breadcrumb navigation** (`Breadcrumb.tsx`)
  - Shows hierarchical category path
  - Clickable segments for all parent categories
  - Current page shown without link
  - Accessible navigation with ARIA labels

- **3-column layout** for post and category pages
  - Left: Collapsible category tree sidebar
  - Center: Main content (55% width on large screens)
  - Right: Table of Contents or Category Info

- **Custom hooks**
  - `useScrollSpy.ts`: IntersectionObserver-based heading tracker
  - `useLocalStorage.ts`: SSR-safe localStorage hook

- **Type definitions**
  - `BreadcrumbSegment`: Type for breadcrumb navigation
  - `TocItem`: Type for table of contents items

- **Constants** (`lib/constants.ts`)
  - `STORAGE_KEYS.TOC_COLLAPSED`: localStorage key for TOC state
  - Cache duration constants for categories and posts

### Changed
- **Brain-origin posts are locked in admin**
  - `PATCH /api/posts` on an `origin: 'brain'` post accepts only `category_id` and `tag_ids`; anything else returns 409. `DELETE` returns 409 (unpublish with `publish: false` in brain)
  - `origin` cannot be set or changed through the API; new admin posts are always `origin: 'admin'`
  - Edit form disables title, content (read-only preview), excerpt and published for brain posts
  - `DELETE /api/media` returns 409 for `brain/` images; post delete never removes `brain/` images
  - `GET /api/posts` admin responses are `private, no-store` instead of edge-cached
- **Tag pages**: `/tags/[slug]` now uses `dynamicParams = true` so newly published tags render without a rebuild
- **Homepage UI paradigm**: Completely replaced 3-panel layout with neural network visualization
  - Removed traditional sidebar navigation
  - Removed post list view from homepage
  - Chat-first interaction model
  - Neural graph replaces category tree navigation
  - Header and Footer removed from homepage (fullscreen neural UI)
- **Color scheme**: Complete redesign with neural network theme
  - Primary accent: Cyan glow (#00FFC8) replacing ocean blue
  - Secondary: Purple nodes (#A78BFA)
  - Background: Deep dark (#080B10) with gradient
  - All admin pages now use neural theme
  - Glow-based shadows instead of traditional drop shadows
- **Font stack**: Added Space Grotesk and IBM Plex Mono for neural UI
- **TypeScript config**: Excluded `node-design` folder from compilation
- **Layout system**: LayoutContent now hides header/footer for homepage
- **Post metadata display**: Removed `updated_at` field from post pages
- **Post page layout**: Refactored to 3-column responsive design
- **Category page layout**: Refactored to 3-column responsive design with `CategoryInfo` sidebar

### Fixed
- **Admin delete errors**: post and media delete in admin now show the API error instead of silently succeeding
- **Hydration error**: Fixed SSR mismatch in NeuralNetwork component
  - Removed dynamic `window.innerWidth` usage during SSR
  - Implemented SVG viewBox for responsive coordinate system
  - Lines now render correctly without hydration warnings
- **ESLint errors**: Resolved all 11 linting errors
  - Fixed type imports across all files
  - Removed unused variables and imports
  - Corrected async function usage in components
- **TypeScript errors**: Fixed JSX namespace and type issues
  - Changed JSX.Element to ReactElement
  - Fixed boolean type coercion in neural network
  - Created shared ChatMessage type

### Performance
- **Static generation**: Category pages now pre-generated at build time
- **ISR optimization**: Category tree cached for 24 hours
- **Client-side caching**: TOC collapse state persisted in localStorage

---

## Project Info

**Tech Stack**:
- Next.js 16 (App Router with Turbopack)
- Supabase (PostgreSQL + pgvector)
- OpenAI API (Embedding + Completion)
- TypeScript
- Framer Motion (animations)
- Radix UI (components)
- Lucide React (icons)

**Cost Optimization**:
- Static-first rendering (SSG/ISR)
- Edge caching with Vercel
- Minimal runtime computation
- Zero paid dependencies

**Architecture**:
- 3-level category hierarchy
- RAG-powered chatbot
- RLS-protected database
- Multi-agent development system (CLAUDE.md)
