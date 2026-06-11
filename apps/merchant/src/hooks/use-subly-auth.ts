import { useCallback, useEffect, useState } from 'react';
import { useWallet, useTransactionSigner } from '@solana/connector/react';
import { sublyApi, getStoredToken, storeToken, clearToken } from '@/lib/subly-api';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export interface SublyAuthState {
  account: string | null;
  token: string | null;
  isAuthenticated: boolean;
  /** Whether the connected wallet exposes message signing (required to sign in). */
  canSignMessage: boolean;
  isSigningIn: boolean;
  error: string | null;
  signIn: () => Promise<string>;
  signOut: () => void;
}

/**
 * Authenticates the connected wallet against the Subly backend: requests a
 * challenge, signs it with the wallet (`solana:signMessage`), exchanges it for a
 * 7-day JWT, and caches the JWT per wallet in localStorage.
 */
export function useSublyAuth(): SublyAuthState {
  const { account } = useWallet();
  const { signer } = useTransactionSigner();
  const [token, setToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load (and validate) any cached token whenever the active wallet changes.
  useEffect(() => {
    setError(null);
    setToken(account ? getStoredToken(account) : null);
  }, [account]);

  const canSignMessage = typeof signer?.signMessage === 'function';

  const signIn = useCallback(async (): Promise<string> => {
    if (!account) throw new Error('Connect your wallet first');
    if (!signer?.signMessage) throw new Error('This wallet does not support message signing');

    setIsSigningIn(true);
    setError(null);
    try {
      const { message, nonce } = await sublyApi.auth.challenge(account);
      const signatureBytes = await signer.signMessage(new TextEncoder().encode(message));
      const { token: jwt } = await sublyApi.auth.verify(account, bytesToBase64(signatureBytes), nonce);
      storeToken(account, jwt);
      setToken(jwt);
      return jwt;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed';
      setError(message);
      throw err;
    } finally {
      setIsSigningIn(false);
    }
  }, [account, signer]);

  const signOut = useCallback(() => {
    if (account) clearToken(account);
    setToken(null);
  }, [account]);

  return {
    account: account ?? null,
    token,
    isAuthenticated: !!token,
    canSignMessage,
    isSigningIn,
    error,
    signIn,
    signOut,
  };
}
