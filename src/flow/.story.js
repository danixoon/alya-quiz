import { StoryFactory } from '../dialog/builder';

const keys = {
  stepFails: 'stepFails',
  score: 'score',
};

const factory = new StoryFactory();
const txt = factory.textFactory;
const f = factory.flowFactory;
const btn = factory.buttonFactory;

const storyFlow = f();
const story = { rootId: storyFlow.id, story: factory.build(storyFlow) };

export default story;
