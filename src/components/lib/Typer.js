import { useEffect, useMemo, useState } from 'react';
import { Transition, animated, useSpring } from '@react-spring/web';
import usePrev from '../hooks/usePrev';

const Typer = ({ id, text = '???', ms, onEnd, clearId, ...rest }) => {
  const [slice, setSlice] = useState(0);

  useEffect(() => {
    if (clearId) {
      setSlice(0);
    }
  }, [clearId]);

  useEffect(() => {
    let intervalId = setInterval(() => {
      setSlice((prev) => {
        let next = prev + 1;
        if (next >= text.length) {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
            onEnd?.(id);
          }
        }

        return next;
      });
    }, ms);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  }, [id, ms, onEnd, text]);

  return <div {...rest}>{text.slice(0, slice)}</div>;
};

export default Typer;
