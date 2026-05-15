'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';

export function Spotlight({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);

  const handleMove = useCallback((e: React.MouseEvent) => {
    setPos({ x: e.clientX, y: e.clientY });
    if (!isActive) setIsActive(true);
  }, [isActive]);

  return (
    <div ref={ref} onMouseMove={handleMove} className="relative">
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-300"
        style={{
          opacity: isActive ? 1 : 0,
          background: `radial-gradient(600px circle at ${pos.x}px ${pos.y}px, rgba(255,255,255,0.035), transparent 40%)`,
        }}
      />
      {children}
    </div>
  );
}
