'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export function BeamReveal({
  children,
  delay = 0,
  duration = 1.4,
  className,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  return (
    <div className={`relative ${className ?? ''}`}>
      {/* ghost layer — barely visible base text */}
      <div className="text-white/[0.04]" aria-hidden>
        {children}
      </div>

      {/* revealed layer — sweeps in from left */}
      <motion.div
        className="absolute inset-0 text-white"
        initial={{ clipPath: 'inset(0 100% 0 0)' }}
        animate={{ clipPath: 'inset(0 0% 0 0)' }}
        transition={{
          duration,
          delay,
          ease: [0.77, 0, 0.175, 1],
        }}
      >
        {children}
      </motion.div>

      {/* beam line — bright scanning edge */}
      <motion.div
        className="pointer-events-none absolute top-0 bottom-0 w-px"
        style={{
          boxShadow: '0 0 40px 15px rgba(255,255,255,0.15), 0 0 8px 2px rgba(255,255,255,0.4)',
          background: 'white',
        }}
        initial={{ left: '0%' }}
        animate={{ left: '100%' }}
        transition={{
          duration,
          delay,
          ease: [0.77, 0, 0.175, 1],
        }}
      />
    </div>
  );
}
