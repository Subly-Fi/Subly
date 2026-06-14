//! Per-plan indexing orchestrator tests — run with: npx tsx src/indexer/index-core.test.ts
//!
//! Exercises the pure cursor/cap/error logic of indexPlanCore with fake deps
//! (no RPC/DB), plus selectIndexBatch.

import assert from 'node:assert/strict';
import { indexPlanCore, selectIndexBatch, type PlanIndexDeps } from './event-listener';

type Sig = { signature: string; err: unknown };

/** Builds fake deps over a fixed newest-first signature list. Records calls. */
function fakeDeps(
  newestFirst: Sig[],
  opts: {
    cursor?: string | null;
    cap?: number;
    flushEvery?: number;
    failOn?: string; // throw when processing this signature
  } = {},
) {
  const processed: string[] = [];
  const saved: string[] = [];
  const deps: PlanIndexDeps = {
    loadCursor: async () => opts.cursor ?? null,
    collectSignatures: async () => newestFirst as never,
    process: async (sig) => {
      if (sig === opts.failOn) throw new Error('boom');
      processed.push(sig);
    },
    saveCursor: async (_plan, sig) => {
      saved.push(sig);
    },
    cap: opts.cap ?? 40,
    flushEvery: opts.flushEvery ?? 10,
  };
  return { deps, processed, saved };
}

function sigs(...specs: (string | [string, boolean])[]): Sig[] {
  // newest-first input (as the RPC returns)
  return specs.map((s) => (Array.isArray(s) ? { signature: s[0], err: s[1] ? {} : null } : { signature: s, err: null }));
}

let passed = 0;
function check(name: string, fn: () => Promise<void> | void) {
  Promise.resolve(fn()).then(
    () => {
      passed++;
      console.log(`  ✓ ${name}`);
    },
    (err) => {
      console.error(`  ✗ ${name}\n    ${err.message}`);
      process.exitCode = 1;
    },
  );
}

// ── selectIndexBatch ────────────────────────────────────────────────────────
check('selectIndexBatch reverses to oldest-first and caps', () => {
  // newest-first: [c, b, a] -> oldest-first capped 2: [a, b]
  assert.deepEqual(selectIndexBatch(['c', 'b', 'a'], 2), ['a', 'b']);
  assert.deepEqual(selectIndexBatch(['c', 'b', 'a'], 10), ['a', 'b', 'c']);
  assert.deepEqual(selectIndexBatch([], 5), []);
});

// ── indexPlanCore ───────────────────────────────────────────────────────────
check('empty signature list: no work, cursor unchanged', async () => {
  const { deps, processed, saved } = fakeDeps([], { cursor: 'X' });
  const r = await indexPlanCore(deps, 'P');
  assert.equal(r.seen, 0);
  assert.equal(r.processed, 0);
  assert.equal(r.to, 'X');
  assert.deepEqual(processed, []);
  assert.deepEqual(saved, []);
});

check('processes all (under cap), cursor advances to newest', async () => {
  // newest-first [c,b,a] -> process oldest->newest a,b,c
  const { deps, processed, saved } = fakeDeps(sigs('c', 'b', 'a'), { cursor: null, cap: 40, flushEvery: 10 });
  const r = await indexPlanCore(deps, 'P');
  assert.equal(r.seen, 3);
  assert.equal(r.processed, 3);
  assert.deepEqual(processed, ['a', 'b', 'c']);
  assert.equal(r.to, 'c');
  // one final flush at the end
  assert.deepEqual(saved.at(-1), 'c');
});

check('cap limits processing to the oldest `cap` txs', async () => {
  const { deps, processed, saved } = fakeDeps(sigs('d', 'c', 'b', 'a'), { cap: 2 });
  const r = await indexPlanCore(deps, 'P');
  assert.equal(r.seen, 4);
  assert.equal(r.processed, 2);
  assert.deepEqual(processed, ['a', 'b']); // oldest two
  assert.equal(r.to, 'b');
  assert.equal(saved.at(-1), 'b');
});

check('failed (err) signature is skipped but advances the cursor', async () => {
  // newest-first [c, b(err), a] -> oldest-first a, b(err skip), c
  const { deps, processed } = fakeDeps(sigs('c', ['b', true], 'a'));
  const r = await indexPlanCore(deps, 'P');
  assert.deepEqual(processed, ['a', 'c']); // b skipped
  assert.equal(r.processed, 2);
  assert.equal(r.to, 'c'); // cursor still advanced past b and to c
});

check('processing error stops the cycle, cursor stays at last good', async () => {
  // oldest-first a, b, c ; fail on b -> process a, stop, cursor = a
  const { deps, processed, saved } = fakeDeps(sigs('c', 'b', 'a'), { failOn: 'b' });
  const r = await indexPlanCore(deps, 'P');
  assert.deepEqual(processed, ['a']);
  assert.equal(r.processed, 1);
  assert.equal(r.to, 'a');
  assert.equal(saved.at(-1), 'a'); // persisted progress up to a
});

check('cursor flushes incrementally every flushEvery txs', async () => {
  // 5 txs, flushEvery 2 -> flush after 2nd and 4th, plus final -> saves include intermediate
  const { deps, saved } = fakeDeps(sigs('e', 'd', 'c', 'b', 'a'), { flushEvery: 2 });
  await indexPlanCore(deps, 'P');
  // oldest-first a,b,c,d,e ; flush at b (2), d (4), final e
  assert.deepEqual(saved, ['b', 'd', 'e']);
});

setTimeout(() => {
  if (!process.exitCode) console.log(`\n${passed} checks passed.`);
}, 100);
