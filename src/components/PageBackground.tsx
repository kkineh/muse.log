'use client';

import { motion } from 'motion/react';

export default function PageBackground({ scrollProgress }: { scrollProgress: number }) {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <svg className="absolute inset-0 w-full h-full opacity-10">
        <defs>
          <pattern id="page-grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <circle cx="25" cy="25" r="1" fill="var(--neural-accent)" opacity="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#page-grid)" />
      </svg>

      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2"
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: scrollProgress > 0 ? [1, 2, 1] : 0,
          opacity: scrollProgress > 0 ? [0.5, 1, 0.5] : 0,
        }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{
            background: 'var(--neural-accent)',
            boxShadow: '0 0 20px var(--neural-accent)',
          }}
        />
      </motion.div>
    </div>
  );
}
