'use client';

import { motion } from 'framer-motion';

interface CodeLine {
  type: 'comment' | 'entry' | 'spacer';
  key?: string;
  value?: string;
  text?: string;
}

const codeLines: CodeLine[] = [
  { type: 'comment', text: '// core' },
  { type: 'entry', key: 'program', value: 'solana-program/subscriptions' },
  { type: 'entry', key: 'audit', value: 'cantina (verified)' },
  { type: 'entry', key: 'runtime', value: 'pinocchio (minimal CU)' },
  { type: 'spacer' },
  { type: 'comment', text: '// stack' },
  { type: 'entry', key: 'client', value: '@solana/kit + codama' },
  { type: 'entry', key: 'token', value: 'SPL Token + Token-2022' },
  { type: 'entry', key: 'events', value: 'anchor-compatible self-CPI' },
  { type: 'spacer' },
  { type: 'comment', text: '// models' },
  { type: 'entry', key: 'fixed', value: 'one-time delegated allowance' },
  { type: 'entry', key: 'recurring', value: 'per-period auto-reset budget' },
  { type: 'entry', key: 'subscription', value: 'merchant plan + pull payments' },
];

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

const line = {
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.25, ease: [0.21, 0.47, 0.32, 0.98] as const },
  },
};

let lineNum = 0;

function renderLine(l: CodeLine, i: number) {
  if (l.type === 'spacer') {
    lineNum++;
    return (
      <motion.div key={i} variants={line} className="flex h-6">
        <span className="w-8 shrink-0 select-none text-right text-zinc-700">{String(lineNum).padStart(2, '0')}</span>
      </motion.div>
    );
  }
  lineNum++;
  const num = String(lineNum).padStart(2, '0');

  if (l.type === 'comment') {
    return (
      <motion.div key={i} variants={line} className="flex">
        <span className="w-8 shrink-0 select-none text-right text-zinc-700">{num}</span>
        <span className="ml-4 text-zinc-600">{l.text}</span>
      </motion.div>
    );
  }

  return (
    <motion.div key={i} variants={line} className="flex">
      <span className="w-8 shrink-0 select-none text-right text-zinc-700">{num}</span>
      <span className="ml-4">
        <span className="text-zinc-500">{l.key}</span>{' '}
        <span className="text-white">{l.value}</span>
      </span>
    </motion.div>
  );
}

export function Tech() {
  lineNum = 0;

  return (
    <section id="tech" className="border-t border-zinc-800 px-6 py-32">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-zinc-500">
            tech
          </p>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            built on audited infrastructure.
          </h2>
        </motion.div>

        <div className="mt-16">
          {/* terminal window with glow */}
          <motion.div
            whileHover={{ boxShadow: '0 0 60px rgba(255,255,255,0.04)' }}
            className="overflow-hidden border border-zinc-800 transition-all duration-500"
          >
            {/* title bar */}
            <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-800" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-800" />
              <span className="ml-3 font-mono text-[11px] text-zinc-600">
                subly — protocol spec
              </span>
            </div>

            {/* code content */}
            <motion.div
              className="bg-zinc-950 p-6 font-mono text-sm leading-relaxed sm:p-8"
              variants={container}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
            >
              {codeLines.map(renderLine)}

              {/* blinking cursor on last line */}
              <div className="mt-1 flex">
                <span className="w-8 shrink-0 select-none text-right text-zinc-700">
                  {String(lineNum + 1).padStart(2, '0')}
                </span>
                <span className="ml-4 inline-block h-4 w-2 animate-blink bg-zinc-500" />
              </div>
            </motion.div>
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 text-sm text-zinc-500"
        >
          open-source core.{' '}
          <a
            href="https://github.com/solana-program/subscriptions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-300 underline underline-offset-4 transition-colors hover:text-white"
          >
            view the program
          </a>
        </motion.p>
      </div>
    </section>
  );
}
