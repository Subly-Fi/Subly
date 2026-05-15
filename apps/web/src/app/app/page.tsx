import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'subly. — coming soon',
  description: 'The subly merchant dashboard is coming soon.',
};

export default function AppPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6">
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">subly.</h1>
      <p className="mt-6 font-mono text-sm uppercase tracking-[0.3em] text-zinc-500">
        coming soon
      </p>
      <p className="mt-4 max-w-sm text-center text-sm text-zinc-600">
        the merchant dashboard is under construction. follow us for updates.
      </p>
      <div className="mt-10 flex items-center gap-6 text-sm">
        <Link
          href="/"
          className="border border-zinc-700 px-6 py-2.5 font-bold uppercase tracking-wider text-zinc-300 transition-all hover:border-zinc-400 hover:text-white"
        >
          back to home
        </Link>
        <a
          href="https://x.com/SublyFi"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-500 transition-colors hover:text-white"
        >
          @SublyFi
        </a>
      </div>
    </div>
  );
}
