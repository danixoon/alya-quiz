import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Button from '../lib/Button';
import Typer from '../lib/Typer';

import { useTransition, animated, update } from '@react-spring/web';
import rootFlow from '../../flow';
import useStateRef from '../hooks/useStateRef';
import useMemoRef from '../hooks/useMemoRef';

const DialogLine = ({ story, style, dialogId, onEnd, ...rest }) => {
  const [textIdx, setTextIdx] = useState(0);
  const isEndedRef = useRef(false);
  const step = useMemo(() => story[dialogId], [dialogId, story]);
  const line = useMemo(
    () =>
      step.texts
        .slice(0, textIdx + 1)
        .map((item) => item.text)
        .join(''),
    [step.texts, textIdx],
  );

  useEffect(() => {
    if (step.texts.length === 0) {
      onEnd();
    }
  }, [onEnd, step.texts.length]);

  useEffect(() => {
    isEndedRef.current = false;
  }, [dialogId]);

  const { duration, text } = step.texts[textIdx] || { duration: 0, text: '' };

  const handleEnd = useCallback(() => {
    const { timeout } = step.texts[textIdx];
    const timeoutId = setTimeout(() => {
      // If last text in dialog
      if (textIdx >= step.texts.length - 1) {
        if ((step.nextId || step.actions?.length > 0) && !isEndedRef.current) {
          isEndedRef.current = true;
          onEnd();
        }
      } else {
        setTextIdx((prev) => prev + 1);
      }
    }, timeout);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [onEnd, step.actions, step.nextId, step.texts, textIdx]);

  return <Typer style={style} ms={duration / text.length} text={line} onEnd={handleEnd} clearId={dialogId} {...rest} />;
};

const Welcome = () => {
  const [ctx, setCtx, ctxRef] = useStateRef({});
  const [dialog, setDialog] = useState({ dialogId: rootFlow.rootId, isIdle: false });
  const story = useRef(rootFlow.story).current;
  const [step] = useMemoRef(() => story[dialog.dialogId], [dialog.dialogId, story]);

  const getActions = useRef((dialogId) => {
    const step = story[dialogId];
    const actions = step.actions?.filter((action) => {
      const { or, and } = action.cond || {};
      if (or) {
        return Object.keys(or).some((k) => {
          const [op, value] = or[k];
          const current = ctxRef.current[k];

          if (['=', 'eq'].includes(op)) {
            return current === value;
          }
          if (['>', 'gt'].includes(op)) {
            return (+current || 0) > (+value || 0);
          }
          if (['<', 'lt'].includes(op)) {
            return (+current || 0) < (+value || 0);
          }

          throw new Error(`Unsupported operator ${op}`);
        });
      }
      if (and) {
        return Object.keys(and).every((k) => {
          const [op, value] = and[k];
          const current = ctxRef.current[k];

          if (['=', 'eq'].includes(op)) {
            return current === value;
          }
          if (['>', 'gt'].includes(op)) {
            return (+current || 0) > (+value || 0);
          }
          if (['<', 'lt'].includes(op)) {
            return (+current || 0) < (+value || 0);
          }

          throw new Error(`Unsupported operator ${op}`);
        });
      }

      return true;
    });

    return actions;
  }).current;

  const updateDialog = useRef((next) => {
    setDialog((prev) => {
      let updated = typeof next === 'function' ? next(prev) : next;

      const nextStep = story[updated.dialogId];

      if (nextStep.conds.length > 0) {
        let nextDialogId = updated.dialogId;
        for (const [key, op, value, targetId] of nextStep.conds) {
          if (['=', 'eq'].includes(op)) {
            if (value === ctxRef.current[key]) {
              nextDialogId = targetId;
              break;
            }
            continue;
          }
          if (['>', 'gt'].includes(op)) {
            if ((+ctxRef.current[key] || 0) > (+value || 0)) {
              nextDialogId = targetId;
              break;
            }
            continue;
          }
          if (['<', 'lt'].includes(op)) {
            if ((+ctxRef.current[key] || 0) < (+value || 0)) {
              nextDialogId = targetId;
              break;
            }
            continue;
          }

          throw new Error(`Unsupported cond operation '${op}'`);
        }
        if (nextDialogId !== updated.dialogId) {
          updated = { ...updated, dialogId: nextDialogId };
        }
      }

      const effects = nextStep.effects;
      if (effects.length > 0) {
        setCtx((prev) => {
          const ctx = { ...prev };
          for (const [key, op, value] of effects) {
            if (op === 'set') {
              ctx[key] = value;
              continue;
            }
            if (op === 'add') {
              ctx[key] = (+ctx[key] || 0) + value;
              continue;
            }
            throw new Error(`Unsupported action operation '${key}'`);
          }

          return ctx;
        });
      }

      return updated;
    });
  }).current;

  const handleEnd = useRef(() => {
    updateDialog((prev) => {
      const step = story[prev.dialogId];
      const actions = getActions(prev.dialogId);

      if (actions?.length > 0) {
        return { ...prev, isIdle: true };
      } else if (step?.nextId) {
        return { ...prev, dialogId: step?.nextId };
      }
      return prev;
    });
  }).current;

  const handleActionClick = useCallback(
    (e) => {
      const actionId = e.currentTarget.dataset.actionId;
      if (!actionId) {
        return;
      }
      const action = step.actions?.find((a) => a.id === actionId);
      if (!action) {
        return;
      }

      const effects = action.effects;
      if (effects.length > 0) {
        setCtx((prev) => {
          const ctx = { ...prev };
          for (const [key, op, value] of effects) {
            if (op === 'set') {
              ctx[key] = value;
              continue;
            }
            if (op === 'add') {
              ctx[key] = (+ctx[key] || 0) + value;
              continue;
            }
            throw new Error(`Unsupported action operation '${key}'`);
          }

          return ctx;
        });
      }

      if (action.nextId) {
        updateDialog((prev) => ({ ...prev, dialogId: action.nextId, isIdle: false }));
      }
    },
    [setCtx, step.actions, updateDialog],
  );

  useEffect(() => {
    console.log('my story:', story);
    console.log('my ctx:', ctx);
  }, [ctx, story]);

  const lineTransitions = useTransition(dialog.dialogId, {
    keys: null,
    from: { opacity: 0, transform: 'translate3d(0,100px,0)' },
    enter: { opacity: 1, transform: 'translate3d(0,0%,0)' },
    leave: { opacity: 0, transform: 'translate3d(0,-20px,0)' },
  });

  const actionTransitions = useTransition(dialog.isIdle ? dialog.dialogId : null, {
    keys: null,
    from: { opacity: 0, transform: 'translate(0px, 100px) scale(1)' },
    enter: { opacity: 1, transform: 'translate(0px, 0px) scale(1)' },
    leave: {
      opacity: 0,
      transform: 'translate(0px, -100px) scale(0.3)',
      transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    },
  });

  return (
    <div className="h-screen max-w-[726px] mx-auto relative overflow-hidden flex flex-col py-4 px-6 gap-8">
      <div className="relative flex-[1]">
        {lineTransitions((style, dialogId) => (
          <div className="absolute top-0 left-0 w-full h-full flex flex-col justify-end items-center">
            <div className="relative flex flex-col gap-8">
              <animated.div style={style}>
                <DialogLine
                  className="text-center text-lg whitespace-pre-wrap"
                  story={story}
                  dialogId={dialogId}
                  onEnd={handleEnd}
                />
              </animated.div>
            </div>
          </div>
        ))}
      </div>
      <div className="relative h-16 flex-[1]">
        {actionTransitions((style, dialogId) => (
          <animated.div
            style={style}
            className="absolute top-0 left-0 w-full h-full flex justify-center items-start gap-4"
          >
            {dialogId ? (
              getActions(dialogId).map((action, i) => (
                <Button key={action.id} data-action-id={action.id} size="md" onClick={handleActionClick}>
                  {action.label}
                </Button>
              ))
            ) : (
              <> </>
            )}
          </animated.div>
        ))}
      </div>
    </div>
  );
};

export default Welcome;
