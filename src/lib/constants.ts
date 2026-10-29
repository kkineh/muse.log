/**
 * Application-wide constants
 * Centralized configuration for cache durations, storage keys, and UI limits
 */

// Cache durations (seconds)
export const CACHE_DURATION = {
  CATEGORY_TREE: 86400, // 24 hours - Categories change infrequently
  POST_LIST: 3600, // 1 hour - Posts may be added/updated
  POST_DETAIL: 86400, // 24 hours - Individual posts change infrequently
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  TOC_COLLAPSED: 'toc-collapsed',
  THEME: 'theme',
  CACHED_CATEGORIES: 'musing_categories',
} as const;

// UI constants
export const CATEGORY_TREE_MAX_DEPTH = 3;
export const POSTS_PER_PAGE = 20;
export const TOC_MAX_HEIGHT_VH = 70;

// Cache TTL for localStorage (milliseconds)
export const CACHE_TTL = {
  CATEGORIES: 3600000, // 1 hour
} as const;

// Supabase Storage key prefix for images uploaded by the brain publish script.
// Admin routes must never pass keys with this prefix to remove().
// (scripts/lib/brain-core.mjs holds the same value; scripts cannot import TS)
export const BRAIN_STORAGE_PREFIX = 'brain/';
