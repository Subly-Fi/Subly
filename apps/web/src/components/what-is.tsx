'use client';

import { motion } from 'framer-motion';
import { ScrollReveal } from './scroll-reveal';
import { Counter } from './counter';
import { TiltCard } from './tilt-card';

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

const solPlans = [
  {
    name: 'weekly',
    price: '1.5',
    currency: 'SOL',
    period: 'week',
    desc: 'pay as you go. cancel anytime.',
    status: 'auto-renews in 4d',
    isHighlighted: false,
  },
  {
    name: 'monthly',
    price: '5',
    currency: 'SOL',
    period: 'month',
    desc: 'best for most teams and projects.',
    status: 'auto-renews in 27d',
    isHighlighted: true,
  },
  {
    name: 'yearly',
    price: '50',
    currency: 'SOL',
    period: 'year',
    desc: 'save 17%. billed once a year.',
    status: 'auto-renews in 341d',
    isHighlighted: false,
  },
];

const usdcPlans = [
  {
    name: 'basic',
    price: '9.99',
    currency: 'USDC',
    period: 'month',
    desc: 'for individuals. simple and affordable.',
    status: 'auto-renews in 29d',
    isHighlighted: false,
  },
  {
    name: 'pro',
    price: '29',
    currency: 'USDC',
    period: 'month',
    desc: 'for growing teams. everything you need.',
    status: 'auto-renews in 29d',
    isHighlighted: true,
  },
  {
    name: 'enterprise',
    price: '199',
    currency: 'USDC',
    period: 'year',
    desc: 'unlimited access. priority support.',
    status: 'auto-renews in 348d',
    isHighlighted: false,
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

          <div className="mt-12 rounded border border-dashed border-zinc-700 p-6 sm:p-8">
            <p className="mb-8 text-center text-xs italic text-zinc-600">
              example preview
            </p>

            {/* SOL plans */}
            <div className="grid gap-4 sm:grid-cols-3">
              {solPlans.map((plan, i) => (
                <ScrollReveal key={plan.name} delay={i * 0.12}>
                  <TiltCard>
                    <div
                      className={`relative flex flex-col border bg-zinc-950 p-8 ${
                        plan.isHighlighted ? 'border-zinc-600' : 'border-zinc-800'
                      }`}
                    >
                      {plan.isHighlighted && (
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
                          {plan.currency}/{plan.period}
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
                    </div>
                  </TiltCard>
                </ScrollReveal>
              ))}
            </div>

            {/* divider */}
            <div className="mt-6 border-t border-zinc-800 pt-6">
              <p className="mb-6 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-600">
                or pay with stablecoins
              </p>
            </div>

            {/* USDC plans */}
            <div className="grid gap-4 sm:grid-cols-3">
              {usdcPlans.map((plan, i) => (
                <ScrollReveal key={plan.name} delay={i * 0.12}>
                  <TiltCard>
                    <div
                      className={`relative flex flex-col border bg-zinc-900/60 p-8 ${
                        plan.isHighlighted ? 'border-zinc-500' : 'border-zinc-700'
                      }`}
                    >
                      {plan.isHighlighted && (
                        <span className="absolute -top-3 left-6 bg-zinc-300 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
                          recommended
                        </span>
                      )}

                      <div className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-500">
                        {plan.name}
                      </div>

                      <div className="mt-4 flex items-baseline gap-1.5">
                        <span className="font-mono text-3xl font-extrabold sm:text-4xl">
                          {plan.price}
                        </span>
                        <span className="font-mono text-sm text-blue-400/60">
                          {plan.currency}/{plan.period}
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-zinc-500">{plan.desc}</p>

                      <div className="mt-6 border border-zinc-600 bg-white/[0.03] px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-zinc-300">
                        pay with USDC
                      </div>

                      <div className="mt-4 flex items-center gap-2 font-mono text-[11px] text-zinc-600">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400/70" />
                        {plan.status}
                      </div>
                    </div>
                  </TiltCard>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
