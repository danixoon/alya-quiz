import { useRef, useState } from 'react';

const useStateRef = (defaultState) => {
  const [state, setState] = useState(defaultState);
  const ref = useRef(state);

  const updateState = useRef((update) =>
    setState((prev) => {
      const next = typeof update === 'function' ? update(prev) : update;
      ref.current = next;
      return next;
    }),
  ).current;

  return [state, updateState, ref];
};

export default useStateRef;
