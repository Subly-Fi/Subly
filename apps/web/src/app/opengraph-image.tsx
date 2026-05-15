import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'subly. — subscriptions on solana';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000000',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 140,
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '-0.03em',
            lineHeight: 1,
          }}
        >
          subly.
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 24,
            color: '#a1a1aa',
            letterSpacing: '0.15em',
            textTransform: 'uppercase' as const,
          }}
        >
          the commerce layer for solana
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            fontSize: 18,
            color: '#52525b',
          }}
        >
          subly.fi
        </div>
      </div>
    ),
    { ...size },
  );
}
