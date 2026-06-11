import { useState, useCallback } from 'react';
import {
  type Address,
  type TransactionSigner,
  address,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  signAndSendTransactionMessageWithSigners,
  createSolanaRpc,
} from '@solana/kit';
import { findAssociatedTokenPda } from '@solana-program/token';
import {
  getSubscribeOverlayInstructionAsync,
  getInitSubscriptionAuthorityOverlayInstructionAsync,
  findSubscriptionAuthorityPda,
  fetchPlan,
  fetchSubscriptionAuthority,
  SUBSCRIPTIONS_PROGRAM_ADDRESS,
  findPlanPda,
} from '@subscriptions/client';
import { cn } from './cn';

const TOKEN_PROGRAM = address('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

export interface SubscribeButtonProps {
  merchant: string;
  planId: number | bigint;
  tokenMint: string;
  rpcUrl?: string;
  programAddress?: string;
  signer?: TransactionSigner;
  onSuccess?: (txSignature: string) => void;
  onError?: (error: Error) => void;
  label?: string;
  amount?: string;
  period?: string;
  className?: string;
}

export function SubscribeButton({
  merchant,
  planId,
  tokenMint,
  rpcUrl = 'https://api.devnet.solana.com',
  programAddress,
  signer,
  onSuccess,
  onError,
  label,
  amount,
  period,
  className,
}: SubscribeButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'init-sa' | 'subscribing' | 'success' | 'error'>('idle');

  const progAddr = programAddress ? address(programAddress) : SUBSCRIPTIONS_PROGRAM_ADDRESS;

  const handleSubscribe = useCallback(async () => {
    if (!signer) {
      onError?.(new Error('No wallet signer provided'));
      return;
    }

    setIsLoading(true);
    setStatus('init-sa');

    try {
      const rpc = createSolanaRpc(rpcUrl);
      const mintAddr = address(tokenMint);
      const merchantAddr = address(merchant);
      const signerAddr = signer.address;

      const [saPda] = await findSubscriptionAuthorityPda(
        { tokenMint: mintAddr, user: signerAddr },
        { programAddress: progAddr },
      );

      const [userAta] = await findAssociatedTokenPda({
        mint: mintAddr,
        owner: signerAddr,
        tokenProgram: TOKEN_PROGRAM,
      });

      const saAccount = await rpc.getAccountInfo(saPda, { encoding: 'base64' }).send();
      if (!saAccount.value) {
        const initIx = await getInitSubscriptionAuthorityOverlayInstructionAsync({
          owner: signer,
          tokenMint: mintAddr,
          tokenProgram: TOKEN_PROGRAM,
          userAta,
          programAddress: progAddr,
        });

        const { value: bh } = await rpc.getLatestBlockhash().send();
        const initMsg = pipe(
          createTransactionMessage({ version: 0 }),
          m => setTransactionMessageFeePayerSigner(signer, m),
          m => setTransactionMessageLifetimeUsingBlockhash(bh, m),
          m => appendTransactionMessageInstruction(initIx, m),
        );
        await signAndSendTransactionMessageWithSigners(initMsg);
      }

      setStatus('subscribing');

      const [planPda] = await findPlanPda(
        { owner: merchantAddr, planId: BigInt(planId) },
        { programAddress: progAddr },
      );

      const planAccount = await fetchPlan(rpc as never, planPda);
      const saData = await fetchSubscriptionAuthority(rpc as never, saPda);

      const subscribeIx = await getSubscribeOverlayInstructionAsync({
        merchant: merchantAddr,
        subscriber: signer,
        planId: BigInt(planId),
        tokenMint: mintAddr,
        expectedAmount: planAccount.data.data.terms.amount,
        expectedPeriodHours: planAccount.data.data.terms.periodHours,
        expectedCreatedAt: planAccount.data.data.terms.createdAt,
        expectedSubscriptionAuthorityInitId: saData.data.initId,
        programAddress: progAddr,
      });

      const { value: bh2 } = await rpc.getLatestBlockhash().send();
      const subMsg = pipe(
        createTransactionMessage({ version: 0 }),
        m => setTransactionMessageFeePayerSigner(signer, m),
        m => setTransactionMessageLifetimeUsingBlockhash(bh2, m),
        m => appendTransactionMessageInstruction(subscribeIx, m),
      );

      const txSig = await signAndSendTransactionMessageWithSigners(subMsg);

      setStatus('success');
      onSuccess?.(typeof txSig === 'string' ? txSig : String(txSig));
    } catch (err) {
      setStatus('error');
      onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [signer, rpcUrl, tokenMint, merchant, planId, progAddr, onSuccess, onError]);

  const buttonLabel = (() => {
    if (status === 'init-sa') return 'Initializing wallet...';
    if (status === 'subscribing') return 'Subscribing...';
    if (status === 'success') return 'Subscribed!';
    if (amount && period) return `${amount} / ${period}`;
    return label ?? 'Subscribe with Solana';
  })();

  return (
    <button
      type="button"
      onClick={handleSubscribe}
      disabled={isLoading || !signer || status === 'success'}
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-lg transition-all',
        'bg-zinc-900 text-white hover:bg-zinc-700',
        'dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2',
        status === 'success' && 'bg-emerald-600 hover:bg-emerald-600 dark:bg-emerald-500',
        className,
      )}
    >
      <SolanaLogo />
      <span className="flex flex-col items-start leading-tight">
        <span className="text-xs opacity-80">{label ?? 'Subscribe with Solana'}</span>
        <span className="font-bold">{buttonLabel}</span>
      </span>
    </button>
  );
}

function SolanaLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M25.5 99.5L43.2 81.1C43.9 80.4 44.8 80 45.8 80H119.7C121.3 80 122.1 81.9 121 83.1L103.3 101.5C102.6 102.2 101.7 102.6 100.7 102.6H26.8C25.2 102.6 24.4 100.7 25.5 99.5Z" fill="currentColor" />
      <path d="M25.5 28.5L43.2 46.9C43.9 47.6 44.8 48 45.8 48H119.7C121.3 48 122.1 46.1 121 44.9L103.3 26.5C102.6 25.8 101.7 25.4 100.7 25.4H26.8C25.2 25.4 24.4 27.3 25.5 28.5Z" fill="currentColor" />
      <path d="M103.3 63.5L121 81.9C122.1 83.1 121.3 85 119.7 85H45.8C44.8 85 43.9 84.6 43.2 83.9L25.5 65.5C24.4 64.3 25.2 62.4 26.8 62.4H100.7C101.7 62.4 102.6 62.8 103.3 63.5Z" fill="currentColor" />
    </svg>
  );
}
