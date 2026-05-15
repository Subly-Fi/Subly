'use client';

import { useState, useEffect, useRef } from 'react';
import { useInView } from 'framer-motion';

interface TerminalLine {
  prefix?: string;
  text: string;
  className?: string;
}

export function TerminalText({
  lines,
  speed = 30,
  lineDelay = 150,
  className,
  onComplete,
}: {
  lines: TerminalLine[];
  speed?: number;
  lineDelay?: number;
  className?: string;
  onComplete?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true });
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (isInView && !hasStarted) setHasStarted(true);
  }, [isInView, hasStarted]);

  useEffect(() => {
    if (!hasStarted || isDone) return;

    if (lineIdx >= lines.length) {
      setIsDone(true);
      onCompleteRef.current?.();
      return;
    }

    const currentText = lines[lineIdx]?.text ?? '';

    if (charIdx >= currentText.length) {
      const id = setTimeout(() => {
        setLineIdx((p) => p + 1);
        setCharIdx(0);
      }, lineDelay);
      return () => clearTimeout(id);
    }

    const id = setTimeout(() => setCharIdx((p) => p + 1), speed);
    return () => clearTimeout(id);
  }, [hasStarted, isDone, lineIdx, charIdx, lines, speed, lineDelay]);

  return (
    <div ref={containerRef} className={className}>
      {lines.map((line, i) => {
        if (i > lineIdx || !hasStarted) return null;

        const text = i < lineIdx ? line.text : line.text.slice(0, charIdx);
        const showCursor = i === lineIdx && !isDone;

        return (
          <div key={i} className={line.className}>
            {line.prefix && <span className="text-zinc-600">{line.prefix}</span>}
            <span>{text}</span>
            {showCursor && (
              <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-blink bg-zinc-500 align-middle" />
            )}
          </div>
        );
      })}
    </div>
  );
}
