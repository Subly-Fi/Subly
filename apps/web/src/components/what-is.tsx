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

const plans = [
  {
    name: 'weekly',
    price: '1.5',
    period: 'week',
    desc: 'pay as you go. cancel anytime.',
    status: 'auto-renews in 4d',
    isPopular: false,
  },
  {
    name: 'monthly',
    price: '5',
    period: 'month',
    desc: 'best for most teams and projects.',
    status: 'auto-renews in 27d',
    isPopular: true,
  },
  {
    name: 'yearly',
    price: '50',
    period: 'year',
    desc: 'save 17%. billed once a year.',
    status: 'auto-renews in 341d',
    isPopular: false,
  },
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

        {/* subscription plans visualization */}
        <div className="mt-24">
          <ScrollReveal>
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-zinc-500">
              how it looks
            </p>
            <h3 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
              subscriptions, powered by your wallet.
            </h3>
          </ScrollReveal>

          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {plans.map((plan, i) => (
              <ScrollReveal key={plan.name} delay={i * 0.12}>
                <motion.div
                  whileHover={{
                    boxShadow: '0 0 30px rgba(255,255,255,0.06)',
                    borderColor: 'rgba(161,161,170,0.4)',
                  }}
                  className={`relative flex flex-col border p-8 transition-all duration-300 ${
                    plan.isPopular ? 'border-zinc-600' : 'border-zinc-800'
                  }`}
                >
                  {plan.isPopular && (
                    <span className="absolute -top-3 left-6 bg-white px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
                      most popular
                    </span>
                  )}

                  <div className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-500">
                    {plan.name}
                  </div>

                  <div className="mt-4 flex items-baseline gap-1.5">
                    <span className="font-mono text-3xl font-extrabold sm:text-4xl">
                      {plan.price}
                    </span>
                    <span className="font-mono text-sm text-zinc-500">
                      SOL/{plan.period}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-zinc-500">{plan.desc}</p>

                  <div className="mt-6 border border-zinc-700 bg-white/[0.02] px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-zinc-300">
                    subscribe with solana
                  </div>

                  <div className="mt-4 flex items-center gap-2 font-mono text-[11px] text-zinc-600">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500/70" />
                    {plan.status}
                  </div>
                </motion.div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
