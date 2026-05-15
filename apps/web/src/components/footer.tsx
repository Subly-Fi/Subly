import { Marquee } from './marquee';

export function Footer() {
  return (
    <footer>
      <Marquee speed={40} reverse />

      <div className="px-6 py-20">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-8 sm:flex-row">
          <div>
            <span className="text-xl font-extrabold tracking-tight">subly.</span>
            <p className="mt-2 font-mono text-xs text-zinc-600">
              De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44
            </p>
          </div>
          <div className="flex items-center gap-8 text-sm text-zinc-500">
            <a
              href="https://twitter.com/SublyFi"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              twitter
            </a>
            <a
              href="https://github.com/Subly-Fi"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              github
            </a>
            <span className="font-mono text-zinc-700">2026</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
