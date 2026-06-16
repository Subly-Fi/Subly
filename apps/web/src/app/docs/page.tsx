import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'docs — subly.',
  description:
    'How Subly works: create subscription plans, share a checkout, get paid automatically, and let customers subscribe and cancel from their own wallet. Non-custodial, on-chain, audited by Cantina.',
  alternates: { canonical: 'https://www.subly.fi/docs' },
};

const toc: { id: string; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'merchants', label: 'For merchants' },
  { id: 'customers', label: 'For customers' },
  { id: 'lifecycle', label: 'Plan lifecycle' },
  { id: 'security', label: 'Security & trust' },
  { id: 'faq', label: 'FAQ' },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-mono uppercase tracking-[0.3em] text-zinc-500">{children}</p>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="relative flex gap-5 pb-8 last:pb-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-zinc-700 bg-black font-mono text-xs text-zinc-400">
        {n}
      </div>
      <div className="pt-1">
        <h4 className="text-base font-bold text-white">{title}</h4>
        <div className="mt-1.5 text-sm leading-relaxed text-zinc-400">{children}</div>
      </div>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-zinc-800 py-6 first:border-t-0">
      <h4 className="text-base font-semibold text-white">{q}</h4>
      <div className="mt-2 text-sm leading-relaxed text-zinc-400">{children}</div>
    </div>
  );
}

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-black">
      {/* header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-lg font-extrabold tracking-tight transition-opacity hover:opacity-80">
              subly.
            </Link>
            <span className="font-mono text-sm text-zinc-600">/ docs</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/" className="hidden text-sm text-zinc-400 transition-colors hover:text-white sm:block">
              home
            </Link>
            <a
              href="https://app.subly.fi"
              className="bg-white px-4 py-1.5 text-sm font-semibold text-black transition-all hover:bg-zinc-200 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >
              launch app
            </a>
          </div>
        </div>
      </header>

      {/* title */}
      <section className="border-b border-zinc-800 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <Eyebrow>documentation</Eyebrow>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
            How Subly works
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            Subly is the commerce layer for Solana — recurring on-chain payments with a merchant
            dashboard and a hosted checkout. It is <span className="text-white">non-custodial</span>:
            Subly never holds your funds. The subscriptions program is audited by Cantina.
          </p>
        </div>
      </section>

      {/* body: sticky TOC + content */}
      <div className="mx-auto max-w-6xl px-6 py-16 lg:grid lg:grid-cols-[200px_1fr] lg:gap-14">
        {/* TOC */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <Eyebrow>on this page</Eyebrow>
            <nav className="mt-4 flex flex-col gap-3">
              {toc.map((t) => (
                <a key={t.id} href={`#${t.id}`} className="text-sm text-zinc-400 transition-colors hover:text-white">
                  {t.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* content */}
        <article className="min-w-0 space-y-20">
          {/* OVERVIEW */}
          <section id="overview" className="scroll-mt-24">
            <Eyebrow>overview</Eyebrow>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">What is Subly?</h2>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
              Subly lets a business charge customers on a recurring schedule using stablecoins on
              Solana — like a card subscription, but on-chain and self-custodial. A merchant creates
              a plan, shares a checkout link, and Subly collects each billing period automatically.
              Customers subscribe with one wallet signature and can cancel any time from their own
              wallet.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ['Non-custodial', 'Funds stay in the customer’s wallet. Subly only pulls what the customer approved, each period.'],
                ['On-chain', 'Plans, subscriptions, and payments live on Solana — transparent and verifiable.'],
                ['Audited', 'The underlying subscriptions program is audited by Cantina.'],
              ].map(([t, d]) => (
                <div key={t} className="border border-zinc-800 p-5">
                  <h3 className="text-sm font-bold text-white">{t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500">{d}</p>
                </div>
              ))}
            </div>
          </section>

          {/* MERCHANTS */}
          <section id="merchants" className="scroll-mt-24">
            <Eyebrow>for merchants</Eyebrow>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">Start selling subscriptions</h2>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
              Everything happens from the dashboard at{' '}
              <a href="https://app.subly.fi" className="text-white underline underline-offset-4 hover:text-zinc-300">app.subly.fi</a>.
            </p>

            <div className="mt-8">
              <Step n="01" title="Connect & sign in">
                Open <a href="https://app.subly.fi" className="text-white underline underline-offset-4">app.subly.fi</a>,
                connect your Solana wallet (Phantom, Solflare, or any wallet), then open
                <span className="text-zinc-300"> Settings → Sign in with wallet</span>. Signing is a
                free message signature (not a transaction) — it lets the dashboard track your plans,
                subscribers, and revenue.
              </Step>
              <Step n="02" title="Create a plan">
                Set the token (USDC), the price, and the billing period (e.g. every 1 hour, day,
                week, or month). Keep <span className="text-zinc-300">“Let Subly collect payments automatically”</span> on
                so Subly pulls each period for you. Creating a plan is a single on-chain transaction.
              </Step>
              <Step n="03" title="Share your checkout">
                Each plan has a <span className="text-zinc-300">Share</span> button with a hosted
                checkout link (<span className="font-mono text-zinc-300">subly.fi/checkout?plan=…</span>)
                and an embed snippet. Put it on your site, in your bio, or send it directly.
              </Step>
              <Step n="04" title="Get paid automatically">
                When a customer subscribes, Subly collects the agreed amount each billing period and
                deposits it to your wallet’s token account. You can watch subscribers and revenue on
                the dashboard. No invoicing, no manual follow-up.
              </Step>
              <Step n="05" title="Settings & integrations">
                From Settings you can copy your API key, set a webhook URL to receive subscription
                events (created, payment received/failed, cancelled), and add an email for payment
                alerts.
              </Step>
            </div>
          </section>

          {/* CUSTOMERS */}
          <section id="customers" className="scroll-mt-24">
            <Eyebrow>for customers</Eyebrow>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">Subscribing &amp; staying in control</h2>

            <div className="mt-8">
              <Step n="01" title="Subscribe in one signature">
                Open the merchant’s checkout link, connect your wallet, and press
                <span className="text-zinc-300"> Subscribe</span>. You’ll need some USDC for the
                payments and a little SOL for network fees. Subscribing approves a delegation with
                the plan’s terms — the amount and the period are fixed on-chain.
              </Step>
              <Step n="02" title="Your money stays yours">
                Subly is non-custodial. Your funds never leave your wallet to sit with Subly. Each
                billing period, only the agreed amount is pulled — never more. You can see every
                payment on-chain.
              </Step>
              <Step n="03" title="Cancel anytime, from your wallet">
                Connect your wallet at <a href="https://app.subly.fi" className="text-white underline underline-offset-4">app.subly.fi</a> →
                <span className="text-zinc-300"> Subscriptions</span> → <span className="text-zinc-300">Unsubscribe</span>.
                Cancelling is your transaction alone — a merchant cannot cancel for you, and cannot
                charge you after you cancel. Your subscription stays active until the end of the
                period you already paid for, then stops.
              </Step>
            </div>
          </section>

          {/* LIFECYCLE */}
          <section id="lifecycle" className="scroll-mt-24">
            <Eyebrow>plan lifecycle</Eyebrow>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">Winding a plan down (merchants)</h2>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
              A plan has two independent controls. Knowing the difference avoids confusion:
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="border border-zinc-800 p-5">
                <h3 className="text-sm font-bold text-white">End date</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  When the plan <span className="text-zinc-300">expires</span>. Must be at least one
                  billing period in the future, so current subscribers keep the period they’ve paid
                  for. A plan can only be <span className="text-zinc-300">deleted</span> after its end
                  date has passed (which reclaims the on-chain rent).
                </p>
              </div>
              <div className="border border-zinc-800 p-5">
                <h3 className="text-sm font-bold text-white">Sunset</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  Stops <span className="text-zinc-300">new</span> subscriptions immediately. Existing
                  subscribers are unaffected. Sunsetting is <span className="text-zinc-300">terminal</span> —
                  a plan can’t go back to active.
                </p>
              </div>
            </div>
            <p className="mt-6 text-sm leading-relaxed text-zinc-400">
              Typical wind-down: <span className="text-white">Active → set an end date (and optionally
              Sunset to stop new sign-ups) → after the end date passes, Delete</span> to close the
              plan and recover rent.
            </p>
          </section>

          {/* SECURITY */}
          <section id="security" className="scroll-mt-24">
            <Eyebrow>security &amp; trust</Eyebrow>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">Why it’s safe</h2>
            <ul className="mt-6 space-y-4">
              {[
                ['Self-custody', 'Subly never holds customer funds. Money stays in the customer’s wallet and is only pulled per the on-chain delegation they approved.'],
                ['Fixed terms', 'The price and billing period are locked on-chain when you subscribe. A merchant cannot charge more than agreed, or charge you after you cancel.'],
                ['Audited program', 'The subscriptions program Subly builds on is audited by Cantina.'],
                ['Open source', 'The code is public on GitHub — anyone can review it.'],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-4">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
                  <span className="text-sm leading-relaxed text-zinc-400">
                    <span className="font-semibold text-white">{t}.</span> {d}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-zinc-500">
              Review the code at{' '}
              <a href="https://github.com/Subly-Fi" target="_blank" rel="noopener noreferrer" className="text-white underline underline-offset-4 hover:text-zinc-300">
                github.com/Subly-Fi
              </a>.
            </p>
          </section>

          {/* FAQ */}
          <section id="faq" className="scroll-mt-24">
            <Eyebrow>faq</Eyebrow>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">Frequently asked</h2>
            <div className="mt-6">
              <Faq q="Does Subly hold my money?">
                No. Subly is non-custodial. Funds stay in your wallet and are only pulled, per
                period, up to the amount you approved when subscribing.
              </Faq>
              <Faq q="Which tokens are supported?">
                USDC today, with support for SPL tokens. The token is set by the merchant on each plan.
              </Faq>
              <Faq q="Can a merchant charge me more than agreed?">
                No. The amount and billing period are fixed on-chain when you subscribe. A merchant
                cannot increase them for an existing subscription, and cannot charge you after you cancel.
              </Faq>
              <Faq q="How do I cancel?">
                Connect your wallet at app.subly.fi → Subscriptions → Unsubscribe. It’s your
                transaction. The subscription stays active until the end of the period you already
                paid for, then stops.
              </Faq>
              <Faq q="Can a merchant cancel my subscription?">
                No — only you can cancel, because it requires your signature. A merchant can stop
                offering a plan (sunset), but cannot end your subscription for you.
              </Faq>
              <Faq q="What if my balance is too low when a payment is due?">
                That period’s payment is skipped. After repeated failed attempts the subscription may
                lapse. Keep enough USDC in your wallet to cover the next payment.
              </Faq>
              <Faq q="What’s the shortest billing period?">
                One hour. Periods can be set in hours, days, weeks, or months.
              </Faq>
            </div>
          </section>

          {/* CTA */}
          <section className="border-t border-zinc-800 pt-12">
            <h2 className="text-xl font-bold text-white">Ready to start?</h2>
            <p className="mt-2 text-sm text-zinc-400">Create your first plan or subscribe in minutes.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href="https://app.subly.fi" className="bg-white px-6 py-3 text-sm font-bold text-black transition-colors hover:bg-zinc-200">
                launch app
              </a>
              <Link href="/" className="border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white">
                back to home
              </Link>
            </div>
          </section>
        </article>
      </div>

      <Footer />
    </main>
  );
}
