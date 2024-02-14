import { useCallback, useState } from 'react';
import './App.css';
import Typer from './components/lib/Typer';
import Initial from './components/steps/Initial';
import Welcome from './components/steps/Quest';

export const STEPS = {
  INITIAL: 'INITIAL',
  WELCOME: 'WELCOME',
};

const stepById = {
  [STEPS.INITIAL]: Initial,
  [STEPS.WELCOME]: Welcome,
};

const stepsIds = [STEPS.INITIAL, STEPS.WELCOME];

const App = () => {
  const [stepId, setStepId] = useState(STEPS.INITIAL);

  const handleNext = useCallback(() => {
    const index = stepsIds.findIndex((id) => id === stepId);
    const nextStepId = stepsIds[(index + 1) % stepsIds.length];

    console.log('next step id:', nextStepId);

    setStepId(nextStepId);
  }, [stepId]);

  const Step = stepById[stepId];

  return (
    <main className="min-h-100">
      <Step onNext={handleNext} />
    </main>
  );
};

export default App;
