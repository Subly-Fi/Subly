'use client';

import { motion } from 'framer-motion';
import { ScrollReveal } from './scroll-reveal';
import { Counter } from './counter';

const stats: Array<{
  value: number | null;
  display?: string;
  prefix?: string;
  suffix?: string;
  label: string;
  desc: string;
}> = [
  { value: 3, label: 'payment models', desc: 'fixed · recurring · subscription' },
  { value: null, display: '<1s', label: 'settlement', desc: 'solana finality' },
  { value: 0, label: 'intermediaries', desc: 'wallet to wallet' },
];

export function WhatIs() {
  return (
    <section id="what" className="border-t border-zinc-800 px-6 py-32">
      <div className="mx-auto max-w-5xl">
        <ScrollReveal>
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-zinc-500">
            what is subly
          </p>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            stripe built recurring payments for the old internet.
            <br />
            <span className="text-zinc-500">we&apos;re building it for solana.</span>
          </h2>
        </ScrollReveal>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {stats.map((s, i) => (
            <ScrollReveal key={s.label} delay={i * 0.12}>
              <motion.div
                whileHover={{
                  boxShadow: '0 0 30px rgba(255,255,255,0.06)',
                  borderColor: 'rgba(161,161,170,0.4)',
                }}
                className="border border-zinc-800 p-10 text-center transition-all duration-300"
              >
                <div className="font-mono text-5xl font-extrabold sm:text-6xl">
                  {s.value !== null ? (
                    <Counter
                      target={s.value}
                      prefix={s.prefix}
                      suffix={s.suffix}
                    />
                  ) : (
                    s.display
                  )}
                </div>
                <div className="mt-3 text-sm font-bold uppercase tracking-wider">
                  {s.label}
                </div>
                <div className="mt-1 text-xs text-zinc-500">{s.desc}</div>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
