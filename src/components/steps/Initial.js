import Button from '../lib/Button';
import Typer from '../lib/Typer';

const Inital = ({ onNext }) => {
  return (
    <div className="flex justify-center items-center h-screen">
      <Button size="lg" onClick={onNext}>
        Начать
      </Button>
    </div>
  );
};

export default Inital;
