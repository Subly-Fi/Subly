//! Decoder verification — run with: npx tsx src/indexer/events.test.ts
//!
//! Builds synthetic event wire bytes by appending fields in declaration order
//! (mirroring the Rust `write_inner` impls), independent of the decoder's offset
//! constants, then asserts the decoder reads them back correctly.

import assert from 'node:assert/strict';
import bs58 from 'bs58';
import {
  EVENT_IX_TAG_LE,
  SublyEventKind,
  decodeSublyEvent,
  decodeSublyEventFromBase58,
  hasEventTag,
} from './events';

type Part =
  | { kind: 'addr'; fill: number }
  | { kind: 'u64'; v: bigint }
  | { kind: 'i64'; v: bigint };

function addr(fill: number): string {
  return bs58.encode(new Uint8Array(32).fill(fill));
}

/** Lays out tag + discriminator + fields appended sequentially (declaration order). */
function buildEvent(disc: number, parts: Part[]): Uint8Array {
  const chunks: number[] = [...EVENT_IX_TAG_LE, disc];
  for (const p of parts) {
    if (p.kind === 'addr') {
      for (let i = 0; i < 32; i++) chunks.push(p.fill);
    } else {
      const buf = new Uint8Array(8);
      const dv = new DataView(buf.buffer);
      if (p.kind === 'u64') dv.setBigUint64(0, p.v, true);
      else dv.setBigInt64(0, p.v, true);
      for (const b of buf) chunks.push(b);
    }
  }
  return new Uint8Array(chunks);
}

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log('decodeSublyEvent:');

check('SubscriptionCreated', () => {
  const bytes = buildEvent(SublyEventKind.SubscriptionCreated, [
    { kind: 'addr', fill: 1 },
    { kind: 'addr', fill: 2 },
    { kind: 'addr', fill: 3 },
    { kind: 'i64', v: 1_700_000_000n },
  ]);
  const e = decodeSublyEvent(bytes);
  assert.ok(e && e.kind === SublyEventKind.SubscriptionCreated);
  assert.equal(e.plan, addr(1));
  assert.equal(e.subscriber, addr(2));
  assert.equal(e.mint, addr(3));
  assert.equal(e.createdTs, 1_700_000_000);
});

check('SubscriptionCancelled (negative ts)', () => {
  const bytes = buildEvent(SublyEventKind.SubscriptionCancelled, [
    { kind: 'addr', fill: 1 },
    { kind: 'addr', fill: 2 },
    { kind: 'i64', v: -1n },
  ]);
  const e = decodeSublyEvent(bytes);
  assert.ok(e && e.kind === SublyEventKind.SubscriptionCancelled);
  assert.equal(e.plan, addr(1));
  assert.equal(e.subscriber, addr(2));
  assert.equal(e.expiresAtTs, -1);
});

check('SubscriptionTransfer', () => {
  const bytes = buildEvent(SublyEventKind.SubscriptionTransfer, [
    { kind: 'addr', fill: 1 }, // subscription
    { kind: 'addr', fill: 2 }, // plan
    { kind: 'addr', fill: 3 }, // delegator
    { kind: 'addr', fill: 4 }, // mint
    { kind: 'u64', v: 1_000_000n }, // amount
    { kind: 'i64', v: 1_700_000_000n }, // period_start
    { kind: 'i64', v: 1_700_003_600n }, // period_end
    { kind: 'u64', v: 1_000_000n }, // amount_pulled
    { kind: 'addr', fill: 5 }, // receiver
  ]);
  const e = decodeSublyEvent(bytes);
  assert.ok(e && e.kind === SublyEventKind.SubscriptionTransfer);
  assert.equal(e.subscription, addr(1));
  assert.equal(e.plan, addr(2));
  assert.equal(e.delegator, addr(3));
  assert.equal(e.mint, addr(4));
  assert.equal(e.amount, 1_000_000n);
  assert.equal(e.periodStartTs, 1_700_000_000);
  assert.equal(e.periodEndTs, 1_700_003_600);
  assert.equal(e.amountPulledInPeriod, 1_000_000n);
  assert.equal(e.receiver, addr(5));
});

check('FixedTransfer', () => {
  const bytes = buildEvent(SublyEventKind.FixedTransfer, [
    { kind: 'addr', fill: 1 }, // delegation
    { kind: 'addr', fill: 2 }, // delegator
    { kind: 'addr', fill: 3 }, // delegatee
    { kind: 'addr', fill: 4 }, // mint
    { kind: 'u64', v: 1_000_000n }, // amount
    { kind: 'u64', v: 500_000n }, // remaining
    { kind: 'addr', fill: 5 }, // receiver
  ]);
  const e = decodeSublyEvent(bytes);
  assert.ok(e && e.kind === SublyEventKind.FixedTransfer);
  assert.equal(e.delegation, addr(1));
  assert.equal(e.delegator, addr(2));
  assert.equal(e.delegatee, addr(3));
  assert.equal(e.mint, addr(4));
  assert.equal(e.amount, 1_000_000n);
  assert.equal(e.remainingAmount, 500_000n);
  assert.equal(e.receiver, addr(5));
});

check('RecurringTransfer', () => {
  const bytes = buildEvent(SublyEventKind.RecurringTransfer, [
    { kind: 'addr', fill: 1 },
    { kind: 'addr', fill: 2 },
    { kind: 'addr', fill: 3 },
    { kind: 'addr', fill: 4 },
    { kind: 'u64', v: 2_500_000n },
    { kind: 'i64', v: 1_700_000_000n },
    { kind: 'i64', v: 1_700_003_600n },
    { kind: 'u64', v: 2_500_000n },
    { kind: 'addr', fill: 5 },
  ]);
  const e = decodeSublyEvent(bytes);
  assert.ok(e && e.kind === SublyEventKind.RecurringTransfer);
  assert.equal(e.delegation, addr(1));
  assert.equal(e.delegatee, addr(3));
  assert.equal(e.amount, 2_500_000n);
  assert.equal(e.periodEndTs, 1_700_003_600);
  assert.equal(e.receiver, addr(5));
});

check('SubscriptionResumed', () => {
  const bytes = buildEvent(SublyEventKind.SubscriptionResumed, [
    { kind: 'addr', fill: 7 },
    { kind: 'addr', fill: 8 },
    { kind: 'i64', v: 1_700_000_000n },
  ]);
  const e = decodeSublyEvent(bytes);
  assert.ok(e && e.kind === SublyEventKind.SubscriptionResumed);
  assert.equal(e.plan, addr(7));
  assert.equal(e.subscriber, addr(8));
  assert.equal(e.resumedTs, 1_700_000_000);
});

check('max u64 amount round-trips', () => {
  const max = (1n << 64n) - 1n;
  const bytes = buildEvent(SublyEventKind.FixedTransfer, [
    { kind: 'addr', fill: 1 },
    { kind: 'addr', fill: 2 },
    { kind: 'addr', fill: 3 },
    { kind: 'addr', fill: 4 },
    { kind: 'u64', v: max },
    { kind: 'u64', v: 0n },
    { kind: 'addr', fill: 5 },
  ]);
  const e = decodeSublyEvent(bytes);
  assert.ok(e && e.kind === SublyEventKind.FixedTransfer);
  assert.equal(e.amount, max);
});

console.log('rejects non-events:');

check('wrong tag → null', () => {
  const bytes = buildEvent(SublyEventKind.SubscriptionCreated, [
    { kind: 'addr', fill: 1 },
    { kind: 'addr', fill: 2 },
    { kind: 'addr', fill: 3 },
    { kind: 'i64', v: 0n },
  ]);
  bytes[0] = 0x00; // corrupt tag
  assert.equal(hasEventTag(bytes), false);
  assert.equal(decodeSublyEvent(bytes), null);
});

check('unknown discriminator → null', () => {
  const bytes = buildEvent(99, [{ kind: 'addr', fill: 1 }]);
  assert.equal(decodeSublyEvent(bytes), null);
});

check('wrong length for discriminator → null', () => {
  const bytes = buildEvent(SublyEventKind.SubscriptionCreated, [
    { kind: 'addr', fill: 1 },
    { kind: 'addr', fill: 2 },
    // missing mint + ts → too short
  ]);
  assert.equal(decodeSublyEvent(bytes), null);
});

check('too short for prefix → null', () => {
  assert.equal(decodeSublyEvent(new Uint8Array([0xe4, 0x45])), null);
});

check('base58 round-trip via decodeSublyEventFromBase58', () => {
  const bytes = buildEvent(SublyEventKind.SubscriptionResumed, [
    { kind: 'addr', fill: 9 },
    { kind: 'addr', fill: 10 },
    { kind: 'i64', v: 42n },
  ]);
  const e = decodeSublyEventFromBase58(bs58.encode(bytes));
  assert.ok(e && e.kind === SublyEventKind.SubscriptionResumed);
  assert.equal(e.resumedTs, 42);
});

check('garbage base58 → null', () => {
  assert.equal(decodeSublyEventFromBase58('not valid base58 !!!'), null);
});

console.log(`\nAll ${passed} checks passed.`);
