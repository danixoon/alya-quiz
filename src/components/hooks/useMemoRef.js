import { useMemo, useRef } from 'react';

const useMemoRef = (fn, deps) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoized = useMemo(fn, deps);
  const ref = useRef(memoized);

  return [memoized, ref];
};

export default useMemoRef;
