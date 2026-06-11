//! On-chain event decoder for the subscriptions program.
//!
//! The program (Pinocchio, `packages/subscriptions/program/src/event_engine.rs`)
//! emits events via an Anchor-compatible self-CPI to its own `EmitEvent`
//! instruction. The CPI's *instruction data* is the event wire format:
//!
//!   [0..8)  EVENT_IX_TAG_LE   (8-byte magic, constant for every event)
//!   [8]     event discriminator (1 byte, see SublyEventKind)
//!   [9..]   packed little-endian payload (Address = 32 raw bytes)
//!
//! Indexers read these by scanning a transaction's inner instructions for data
//! beginning with EVENT_IX_TAG_LE. Note: the first tag byte (0xe4 = 228) is also
//! the EmitEvent instruction discriminator, so the program routes the self-CPI to
//! its no-op handler while the full bytes remain visible to indexers.
//!
//! Byte layouts are verified against the Rust structs in
//! `packages/subscriptions/program/src/events/*.rs` (all `#[repr(C, packed)]`).

import bs58 from 'bs58';

/** Little-endian bytes of EVENT_IX_TAG = 0x1d9acb512ea545e4 (Sha256("anchor:event")[..8]). */
export const EVENT_IX_TAG_LE = new Uint8Array([0xe4, 0x45, 0xa5, 0x2e, 0x51, 0xcb, 0x9a, 0x1d]);

/** Instruction discriminator of the EmitEvent no-op handler (== EVENT_IX_TAG_LE[0]). */
export const EMIT_EVENT_IX_DISC = 228;

/** Wire prefix length: 8-byte tag + 1-byte event discriminator. */
export const EVENT_PREFIX_LEN = 9;

/** Event discriminator values (9th byte of the wire format). */
export enum SublyEventKind {
  SubscriptionCreated = 0,
  SubscriptionCancelled = 1,
  SubscriptionTransfer = 2,
  FixedTransfer = 3,
  RecurringTransfer = 4,
  SubscriptionResumed = 5,
}

export interface SubscriptionCreatedEvent {
  kind: SublyEventKind.SubscriptionCreated;
  plan: string;
  subscriber: string;
  mint: string;
  createdTs: number;
}

export interface SubscriptionCancelledEvent {
  kind: SublyEventKind.SubscriptionCancelled;
  plan: string;
  subscriber: string;
  expiresAtTs: number;
}

export interface SubscriptionTransferEvent {
  kind: SublyEventKind.SubscriptionTransfer;
  subscription: string;
  plan: string;
  delegator: string;
  mint: string;
  amount: bigint;
  periodStartTs: number;
  periodEndTs: number;
  amountPulledInPeriod: bigint;
  receiver: string;
}

export interface FixedTransferEvent {
  kind: SublyEventKind.FixedTransfer;
  delegation: string;
  delegator: string;
  delegatee: string;
  mint: string;
  amount: bigint;
  remainingAmount: bigint;
  receiver: string;
}

export interface RecurringTransferEvent {
  kind: SublyEventKind.RecurringTransfer;
  delegation: string;
  delegator: string;
  delegatee: string;
  mint: string;
  amount: bigint;
  periodStartTs: number;
  periodEndTs: number;
  amountPulledInPeriod: bigint;
  receiver: string;
}

export interface SubscriptionResumedEvent {
  kind: SublyEventKind.SubscriptionResumed;
  plan: string;
  subscriber: string;
  resumedTs: number;
}

export type SublyEvent =
  | SubscriptionCreatedEvent
  | SubscriptionCancelledEvent
  | SubscriptionTransferEvent
  | FixedTransferEvent
  | RecurringTransferEvent
  | SubscriptionResumedEvent;

/** Expected total wire length (prefix + payload) for each event kind. */
const EVENT_TOTAL_LEN: Record<SublyEventKind, number> = {
  [SublyEventKind.SubscriptionCreated]: EVENT_PREFIX_LEN + 104,
  [SublyEventKind.SubscriptionCancelled]: EVENT_PREFIX_LEN + 72,
  [SublyEventKind.SubscriptionTransfer]: EVENT_PREFIX_LEN + 192,
  [SublyEventKind.FixedTransfer]: EVENT_PREFIX_LEN + 176,
  [SublyEventKind.RecurringTransfer]: EVENT_PREFIX_LEN + 192,
  [SublyEventKind.SubscriptionResumed]: EVENT_PREFIX_LEN + 72,
};

function readAddress(data: Uint8Array, offset: number): string {
  return bs58.encode(data.subarray(offset, offset + 32));
}

function readU64(data: Uint8Array, offset: number): bigint {
  return new DataView(data.buffer, data.byteOffset + offset, 8).getBigUint64(0, true);
}

function readI64AsNumber(data: Uint8Array, offset: number): number {
  return Number(new DataView(data.buffer, data.byteOffset + offset, 8).getBigInt64(0, true));
}

/** True if `data` begins with the event tag and is long enough to hold a discriminator. */
export function hasEventTag(data: Uint8Array): boolean {
  if (data.length < EVENT_PREFIX_LEN) return false;
  for (let i = 0; i < EVENT_IX_TAG_LE.length; i++) {
    if (data[i] !== EVENT_IX_TAG_LE[i]) return false;
  }
  return true;
}

/**
 * Decodes a single subscriptions-program event from raw instruction data.
 * Returns `null` if the data is not a recognized event (wrong tag, unknown
 * discriminator, or wrong length) — never throws.
 */
export function decodeSublyEvent(data: Uint8Array): SublyEvent | null {
  if (!hasEventTag(data)) return null;

  const disc = data[8] as SublyEventKind;
  if (!(disc in EVENT_TOTAL_LEN)) return null;
  if (data.length !== EVENT_TOTAL_LEN[disc]) return null;

  switch (disc) {
    case SublyEventKind.SubscriptionCreated:
      return {
        kind: disc,
        plan: readAddress(data, 9),
        subscriber: readAddress(data, 41),
        mint: readAddress(data, 73),
        createdTs: readI64AsNumber(data, 105),
      };

    case SublyEventKind.SubscriptionCancelled:
      return {
        kind: disc,
        plan: readAddress(data, 9),
        subscriber: readAddress(data, 41),
        expiresAtTs: readI64AsNumber(data, 73),
      };

    case SublyEventKind.SubscriptionTransfer:
      return {
        kind: disc,
        subscription: readAddress(data, 9),
        plan: readAddress(data, 41),
        delegator: readAddress(data, 73),
        mint: readAddress(data, 105),
        amount: readU64(data, 137),
        periodStartTs: readI64AsNumber(data, 145),
        periodEndTs: readI64AsNumber(data, 153),
        amountPulledInPeriod: readU64(data, 161),
        receiver: readAddress(data, 169),
      };

    case SublyEventKind.FixedTransfer:
      return {
        kind: disc,
        delegation: readAddress(data, 9),
        delegator: readAddress(data, 41),
        delegatee: readAddress(data, 73),
        mint: readAddress(data, 105),
        amount: readU64(data, 137),
        remainingAmount: readU64(data, 145),
        receiver: readAddress(data, 153),
      };

    case SublyEventKind.RecurringTransfer:
      return {
        kind: disc,
        delegation: readAddress(data, 9),
        delegator: readAddress(data, 41),
        delegatee: readAddress(data, 73),
        mint: readAddress(data, 105),
        amount: readU64(data, 137),
        periodStartTs: readI64AsNumber(data, 145),
        periodEndTs: readI64AsNumber(data, 153),
        amountPulledInPeriod: readU64(data, 161),
        receiver: readAddress(data, 169),
      };

    case SublyEventKind.SubscriptionResumed:
      return {
        kind: disc,
        plan: readAddress(data, 9),
        subscriber: readAddress(data, 41),
        resumedTs: readI64AsNumber(data, 73),
      };

    default:
      return null;
  }
}

/** Decodes a base58-encoded instruction `data` string into an event, or null. */
export function decodeSublyEventFromBase58(dataBase58: string): SublyEvent | null {
  let bytes: Uint8Array;
  try {
    bytes = bs58.decode(dataBase58);
  } catch {
    return null;
  }
  return decodeSublyEvent(bytes);
}
