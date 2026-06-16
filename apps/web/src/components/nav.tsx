'use client';

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Github } from 'lucide-react';
import { ScrollProgress } from './scroll-progress';
import { XIcon, TelegramIcon } from './icons';

interface NavLink {
  href: string;
  label: string;
  icon?: ReactNode;
  isExternal?: boolean;
}

const links: NavLink[] = [
  { href: '#what', label: 'what' },
  { href: '#how', label: 'how' },
  { href: '#for-who', label: 'for who' },
  { href: '#tech', label: 'tech' },
  { href: '/docs', label: 'docs' },
  { href: 'https://github.com/Subly-Fi', label: 'github', icon: <Github size={16} />, isExternal: true },
  { href: 'https://x.com/SublyFi', label: 'x', icon: <XIcon size={16} />, isExternal: true },
  { href: 'https://t.me/sublyfi', label: 'telegram', icon: <TelegramIcon size={16} />, isExternal: true },
];

export function Nav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <a href="#" className="text-lg font-extrabold tracking-tight transition-opacity hover:opacity-80">
          subly.
        </a>

        <div className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              {...(l.isExternal && { target: '_blank', rel: 'noopener noreferrer' })}
              className="text-sm text-zinc-400 transition-colors hover:text-white"
              aria-label={l.label}
            >
              {l.icon ?? l.label}
            </a>
          ))}
          <a
            href="https://app.subly.fi"
            className="bg-white px-4 py-1.5 text-sm font-semibold text-black transition-all hover:bg-zinc-200 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]"
          >
            launch app
          </a>
        </div>

        <button
          onClick={() => setIsOpen((p) => !p)}
          className="text-zinc-400 transition-colors hover:text-white md:hidden"
          aria-label="Toggle menu"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <ScrollProgress />

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-zinc-800 bg-black md:hidden"
          >
            <div className="space-y-4 px-6 py-6">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setIsOpen(false)}
                  {...(l.isExternal && { target: '_blank', rel: 'noopener noreferrer' })}
                  className="flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white"
                  aria-label={l.label}
                >
                  {l.icon && <span>{l.icon}</span>}
                  <span>{l.label}</span>
                </a>
              ))}
              <a
                href="https://app.subly.fi"
                className="block bg-white px-4 py-2.5 text-center text-sm font-semibold text-black transition-colors hover:bg-zinc-200"
              >
                launch app
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
