import { useEffect, useRef } from 'react';

const usePrev = (value) => {
  const prev = useRef(value);

  useEffect(() => {
    prev.current = value;
  }, [value]);

  return prev.current;
};

export default usePrev;
