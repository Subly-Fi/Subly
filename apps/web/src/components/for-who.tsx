'use client';

import { motion } from 'framer-motion';
import { Store, Code, Users, Bot } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Audience {
  title: string;
  icon: LucideIcon;
  items: string[];
  span?: string;
}

const audiences: Audience[] = [
  {
    title: 'merchants',
    icon: Store,
    span: 'sm:col-span-2',
    items: [
      'dashboard with MRR, churn, analytics',
      'create plans, manage subscribers',
      'webhook + email notifications',
      'CSV export, invoicing',
    ],
  },
  {
    title: 'developers',
    icon: Code,
    items: [
      'high-level SDK: subscribe(plan, wallet)',
      'embeddable "subscribe with solana" button',
      'indexer infrastructure',
      'webhook delivery',
    ],
  },
  {
    title: 'users',
    icon: Users,
    items: [
      'subscription management hub',
      'see all delegations in one place',
      'cancel anything with one click',
      'full payment history',
    ],
  },
  {
    title: 'agents',
    icon: Bot,
    span: 'sm:col-span-2',
    items: [
      'autonomous service subscriptions',
      'wallet-based budget limits',
      'programmatic delegation management',
      'no human approval needed',
    ],
  },
];

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const card = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] as const },
  },
};

export function ForWho() {
  return (
    <section id="for-who" className="border-t border-zinc-800 px-6 py-32">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-zinc-500">
            for who
          </p>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            everyone gets something.
          </h2>
        </motion.div>

        <motion.div
          className="mt-16 grid gap-4 sm:grid-cols-2"
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
        >
          {audiences.map((a) => {
            const Icon = a.icon;
            return (
              <motion.div
                key={a.title}
                variants={card}
                whileHover={{
                  boxShadow: '0 0 30px rgba(255,255,255,0.06)',
                  borderColor: 'rgba(161,161,170,0.4)',
                }}
                className={`border border-zinc-800 p-8 transition-all duration-300 sm:p-10 ${a.span ?? ''}`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={20} className="text-zinc-400" strokeWidth={1.5} />
                  <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-400">
                    {a.title}
                  </h3>
                </div>
                <ul className="mt-6 space-y-3">
                  {a.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 text-sm text-zinc-300"
                    >
                      <span className="mt-1.5 h-1 w-1 shrink-0 bg-white" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
