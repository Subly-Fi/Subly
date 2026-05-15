'use client';

import { useEffect, useRef } from 'react';
import { useInView, useMotionValue, useSpring, motion, useTransform } from 'framer-motion';

export function Counter({
  target,
  prefix = '',
  suffix = '',
  className,
}: {
  target: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 80, damping: 20 });
  const display = useTransform(spring, (v) => `${prefix}${Math.round(v)}${suffix}`);

  useEffect(() => {
    if (isInView) motionVal.set(target);
  }, [isInView, motionVal, target]);

  return <motion.span ref={ref} className={className}>{display}</motion.span>;
}
