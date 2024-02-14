import { StoryFactory } from '../dialog/builder';

const keys = {
  stepFails: 'stepFails',
  score: 'score',
};

const factory = new StoryFactory();
const txt = factory.textFactory;
const f = factory.flowFactory;
const btn = factory.buttonFactory;

const rootFlow = f('root')
  .text(
    txt`Здравствуй. ${txt.wait(
      3000,
    )} У меня совсем не было времени закончить кое-что интересное,${txt.wait()}поэтому...${txt.ms(
      200,
    )} Придётся сделать всё кратко.
`,
  )
  .join()
  .text(
    txt`С 14 февраля, котёнок!\n${txt.wait(2000)} В общем-то, ты няшулечка. ${txt.wait(
      2000,
    )}Может и день как день, но хороший повод чтобы сделать что-нибудь интересное. `,
  )
  .join()
  .text(
    txt`В общем, будь счастлива${txt.wait()}!!!!!!${txt.ms(100)} ${txt.wait(2000)}Я тебя люблю.${txt.ms(
      200,
    )} Надеюсь, любишь ты меня больше, чем пингвина?`,
  )
  .button(btn('Я тебя люблю', (b) => b.text(txt`И я тебя, пусик!`).to('root')))
  .button(btn('Где мой подарок >(', (b) => b.text(txt`Подсказка где-то тут ;)`).to('root')))
  .button(
    btn('<схватить даню за попу>', (b) =>
      b.text(txt`Access granted.\n${txt.wait(3000)}Можешь схватить меня за попу.`).to('root'),
    ),
  )
  .join()
  .to('root');

const storyFlow = rootFlow;
const story = { rootId: storyFlow.id, story: factory.build(storyFlow) };

export default story;
