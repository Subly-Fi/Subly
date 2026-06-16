'use client';

import { motion } from 'framer-motion';
import { BeamReveal } from './beam-reveal';
import { CopyAddress } from './copy-address';

const ease = [0.21, 0.47, 0.32, 0.98] as const;

const TX_FEED = [
  '◎ 2.50 SOL → merchant_9kx',
  '◎ 0.10 SOL → dao_vlt',
  '◎ 1.00 SOL → saas_pro',
  '◎ 5.00 SOL → guild_abc',
  '◎ 0.25 SOL → api_node',
  '◎ 3.00 SOL → nft_sub',
  '◎ 0.50 SOL → infra_io',
  '◎ 12.0 SOL → enterprise',
];

function TxFeed() {
  const items = TX_FEED.map((tx) => (
    <span key={tx} className="mx-6 shrink-0 whitespace-nowrap">{tx}</span>
  ));
  return (
    <div className="mt-20 overflow-hidden border-y border-zinc-800/40 py-3 font-mono text-[11px] text-zinc-600">
      <div className="flex w-max" style={{ animation: 'marquee 25s linear infinite' }}>
        <div className="flex shrink-0">{items}</div>
        <div className="flex shrink-0" aria-hidden>{items}</div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-14">
      {/* breathing grid background */}
      <div
        className="pointer-events-none absolute inset-0 animate-grid-breathe"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* center glow pulse */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.02] blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-5xl text-center">
        {/* tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-8 text-xs font-mono uppercase tracking-[0.3em] text-zinc-500"
        >
          the commerce layer for solana
        </motion.p>

        {/* beam reveal title */}
        <BeamReveal delay={0.5} duration={1.4}>
          <h1 className="text-7xl font-extrabold tracking-tight sm:text-8xl lg:text-[10rem] lg:leading-none">
            subly.
          </h1>
        </BeamReveal>

        {/* description */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 1.8, ease }}
          className="mx-auto mt-10 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg"
        >
          <p>
            recurring payments on solana.
            <br />
            no banks. no credit cards. just wallets.
          </p>
          <p className="mt-4">
            merchants get a dashboard.
            <br />
            developers get an sdk.
            <br />
            users get control.
          </p>
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 2.2, ease }}
          className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <a
            href="https://app.subly.fi"
            className="group relative w-full overflow-hidden bg-white px-8 py-3 text-sm font-bold uppercase tracking-wider text-black transition-colors hover:bg-zinc-200 sm:w-auto"
          >
            <span className="relative z-10">launch app</span>
          </a>
          <a
            href="https://github.com/Subly-Fi"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full border border-zinc-700 px-8 py-3 text-sm font-bold uppercase tracking-wider text-zinc-300 transition-all hover:border-zinc-400 hover:text-white hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] sm:w-auto"
          >
            view source
          </a>
        </motion.div>

        {/* token CA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 2.6 }}
          className="mt-6"
        >
          <CopyAddress
            label="CA"
            address="FwiaNTvgRCHEZGeKAfwcSE5KDxmh7jJPssT1pWqVpump"
          />
        </motion.div>
      </div>

      {/* live tx feed */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 3 }}
        className="absolute bottom-0 left-0 right-0"
      >
        <TxFeed />
      </motion.div>
    </section>
  );
}
