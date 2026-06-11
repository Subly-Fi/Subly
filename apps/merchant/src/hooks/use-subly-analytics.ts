import { useQuery } from '@tanstack/react-query';
import { useSublyAuth } from './use-subly-auth';
import { sublyApi } from '@/lib/subly-api';

/**
 * Fetches the merchant's off-chain analytics summary (revenue, payment count,
 * subscription counts) from the Subly backend. Only runs once the wallet has
 * authenticated. Reflects the indexed/collected mirror, not direct on-chain reads.
 */
export function useSublyAnalytics() {
  const { account, token, isAuthenticated } = useSublyAuth();

  return useQuery({
    queryKey: ['subly-analytics', 'summary', account],
    enabled: isAuthenticated && !!account && !!token,
    queryFn: () => sublyApi.analytics.summary(account as string, token as string),
    staleTime: 30_000,
    retry: 1,
  });
}
