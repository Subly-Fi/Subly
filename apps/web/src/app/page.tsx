import { Spotlight } from '@/components/spotlight';
import { Nav } from '@/components/nav';
import { Hero } from '@/components/hero';
import { Marquee } from '@/components/marquee';
import { WhatIs } from '@/components/what-is';
import { HowItWorks } from '@/components/how-it-works';
import { ForWho } from '@/components/for-who';
import { Tech } from '@/components/tech';
import { Footer } from '@/components/footer';

export default function HomePage() {
  return (
    <Spotlight>
      <main className="min-h-screen bg-black">
        <Nav />
        <Hero />
        <Marquee />
        <WhatIs />
        <HowItWorks />
        <ForWho />
        <Tech />
        <Footer />
      </main>
    </Spotlight>
  );
}
