'use client';

import { motion, useScroll, useSpring } from 'framer-motion';

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 50 });

  return (
    <motion.div
      className="h-px origin-left bg-white"
      style={{ scaleX }}
    />
  );
}
