'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const steps = [
  {
    num: '01',
    title: 'connect wallet',
    desc: 'phantom, solflare, or any solana wallet. one click.',
  },
  {
    num: '02',
    title: 'approve delegation',
    desc: 'set spending limits. per-period caps. you stay in control.',
  },
  {
    num: '03',
    title: 'automatic payments',
    desc: 'merchant pulls funds each period. no manual action needed.',
  },
  {
    num: '04',
    title: 'cancel anytime',
    desc: 'one transaction. instant. no phone calls, no emails.',
  },
];

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const item = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] as const },
  },
};

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end center'],
  });
  const lineHeight = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  return (
    <section id="how" ref={sectionRef} className="border-t border-zinc-800 px-6 py-32">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-zinc-500">
            how it works
          </p>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            four steps. that&apos;s it.
          </h2>
        </motion.div>

        <motion.div
          className="relative mt-16"
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
        >
          {/* static track */}
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-zinc-800/50 sm:left-[23px]" />
          {/* scroll-driven fill */}
          <motion.div
            className="absolute left-[19px] top-0 w-px origin-top bg-white sm:left-[23px]"
            style={{ height: lineHeight }}
          />

          {steps.map((step) => (
            <motion.div
              key={step.num}
              variants={item}
              className="relative flex gap-6 pb-14 last:pb-0 sm:gap-8"
            >
              <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center border border-zinc-700 bg-black font-mono text-xs text-zinc-400 transition-all duration-300 hover:border-zinc-500 hover:text-white hover:shadow-[0_0_20px_rgba(255,255,255,0.08)] sm:h-12 sm:w-12 sm:text-sm">
                {step.num}
              </div>
              <div className="pt-1.5 sm:pt-2.5">
                <h3 className="text-lg font-bold sm:text-xl">{step.title}</h3>
                <p className="mt-2 text-sm text-zinc-400 sm:text-base">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
