import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

interface State<T> {
    data: T | undefined;
    error: Error | undefined;
    /** Which `version` the current data/error belongs to. */
    settledVersion: number;
}

/**
 * Load data on mount and on `reload()`. Keeps showing the previous data while
 * reloading. `fetcher` must be stable (module-level or memoized).
 *
 * If this grows (caching across components, background refresh, mutations),
 * swap it for TanStack Query — it works the same in React Native.
 */
export function useApiData<T>(fetcher: () => Promise<T>) {
    const [version, setVersion] = useState(0);
    const [state, setState] = useState<State<T>>({ data: undefined, error: undefined, settledVersion: -1 });

    useEffect(() => {
        let cancelled = false;
        fetcher().then(
            data => !cancelled && setState({ data, error: undefined, settledVersion: version }),
            error => !cancelled && setState(prev => ({ ...prev, error, settledVersion: version })),
        );
        return () => {
            cancelled = true;
        };
    }, [fetcher, version]);

    const reload = useCallback(() => setVersion(v => v + 1), []);
    /** Apply a local change (e.g. the server's response to a mutation) without refetching. */
    const mutate = useCallback(
        (update: (current: T | undefined) => T) => setState(prev => ({ ...prev, data: update(prev.data) })),
        [],
    );

    return { data: state.data, error: state.error, loading: state.settledVersion !== version, reload, mutate };
}

export const useCategories = () => useApiData(api.categories.list);
export const useTags = () => useApiData(api.tags.list);
