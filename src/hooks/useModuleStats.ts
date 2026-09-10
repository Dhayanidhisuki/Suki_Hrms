import { useState, useEffect } from 'react';
import type { ModuleStats } from '@/lib/kpiUtils';

export function useModuleStats(module: string) {
  const [stats, setStats] = useState<ModuleStats>({ total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/stats/${module}`);
        if (!res.ok) throw new Error('Failed to fetch stats');
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStats({ total: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [module]);

  return { stats, loading, error };
}
