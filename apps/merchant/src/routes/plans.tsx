import { MyPlansPanel } from '@/components/plan/my-plans-panel';
import { useSyncPlans } from '@/hooks/use-sync-plans';

export function Plans() {
    // Register the merchant's plan PDAs with the backend indexer (incl. newly
    // created ones, since creating a plan refetches the list).
    useSyncPlans();
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Plans</h1>
            <MyPlansPanel />
        </div>
    );
}
