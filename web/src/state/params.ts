import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { decodeParams, encodeParams, type Params } from '../engine/params';

/** Strategy parameters live in the URL (?p=...) so any configuration can be shared. */
export function useParams(): [Params, (p: Params) => void] {
  const [search, setSearch] = useSearchParams();
  const encoded = search.get('p');
  const params = useMemo(() => decodeParams(encoded), [encoded]);
  const set = useCallback(
    (p: Params) => {
      const e = encodeParams(p);
      setSearch(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (e) next.set('p', e);
          else next.delete('p');
          return next;
        },
        { replace: true },
      );
    },
    [setSearch],
  );
  return [params, set];
}
