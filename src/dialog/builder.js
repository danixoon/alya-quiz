import { v4 as uuidv4 } from 'uuid';

const uuid = () => uuidv4().slice(0, 4);

export class BuilderContext {
  constructor() {
    this.targetMap = new Map();
    this.targetBuildersMap = new Map();
    this.state = 'idle';
    this.builders = [];
  }

  getTarget(id) {
    return this.targetMap.get(id);
  }

  registerTarget(id, target) {
    if (this.targetMap.has(id)) {
      return;
    }

    this.targetMap.set(id, target);
  }

  addTarget(target, buildFn, unfreeze) {
    const builder = { buildFn, target, unfreeze };
    this.builders.push(builder);
  }

  cloneTarget(originalId, target) {
    const originalBuilders = this.builders.filter((b) => b.target.id === originalId);
    originalBuilders.forEach((builder) => {
      this.builders.push({ target, ...builder });
    });
  }

  build() {
    const items = [...this.builders].reverse();
    for (const { buildFn, target } of items) {
      buildFn(target);
    }
    this.state = 'idle';
  }
}

export class StoryFactory {
  constructor() {
    this._ctx = new BuilderContext();

    this.flowFactory = (name = 'gen') => {
      const flow = new FlowBuilder({ name, factory: this });
      this._ctx.registerTarget(name, flow);
      return flow;
    };
    this.flowFactory.write = (text, timeout = 500, duration = 1000) => ({ text, duration, timeout });
    this.flowFactory.say = (text, timeout = 500, interval = 50) => ({
      text,
      duration: text.length * interval,
      timeout,
    });
    this.flowFactory.text = (...args) => this.flowFactory().text(...args);
    this.flowFactory.clone = (obj) => {
      const cloneByOriginalId = {};
      const clone = (original, prev) => {
        if (cloneByOriginalId[original._originalId]) {
          return cloneByOriginalId[original._originalId];
        }

        let cloned = new FlowBuilder({
          name: `clone_${original._name}`,
          factory: this,
          prev: prev ?? original._prev,
          originalId: original._originalId || original.id,
        });

        this._ctx.cloneTarget(original.id, cloned);

        // if (cached) {
        //   return target;
        // }

        cloneByOriginalId[cloned._originalId] = cloned;

        cloned._texts = original._texts.map((t) => ({ ...t }));
        cloned._conds = original._conds.map((c) => [...c]);
        cloned._effects = original._effects.map((e) => [...e]);
        // !!! Do not clone buttons in this step
        cloned._buttons = original._buttons.map((b) => b);

        cloned._next = original._next ? clone(original._next, cloned) : null;

        return cloned;
      };

      return clone(obj);
    };

    /**
     *
     * @param {string} label
     * @param {(b: ButtonBuilder) => ButtonBuilder} buildFn
     * @returns
     */
    this.buttonFactory = (label, buildFn) => {
      const builder = new ButtonBuilder({ name: 'gen', factory: this }).label(label);
      this._ctx.addTarget(builder, buildFn);

      return builder;
    };
    this.buttonFactory.clone = (original) => {
      throw new Error('Cloning prohibited.');
      let clone = new ButtonBuilder({ ctx: this._ctx, name: `clone_${original._name}` });
      clone = this._ctx.cloneTarget(original.id, clone);

      clone._next = original._next;
      clone._texts = original._texts.map((t) => ({ ...t }));
      clone._label = original._label;
      clone._effects = { ...original._effect };
      clone._andCond = { ...original._andCond };
      clone._orCond = { ...original._orCond };
      clone._parent = original._parent;

      return clone;
    };
    this.buttonFactory.text = (...args) => this.buttonFactory().text(...args);
    this.buttonFactory.retext = (...args) => this.buttonFactory().retext(...args);
    this.buttonFactory.pretext = (...args) => this.buttonFactory().pretext(...args);
    this.buttonFactory.and = (...args) => this.buttonFactory().and(...args);
    this.buttonFactory.or = (...args) => this.buttonFactory().or(...args);

    this.textFactory = (...args) => TextBuilder.text(...args);
    this.textFactory.ms = TextBuilder.ms;
    this.textFactory.wait = TextBuilder.wait;
  }

  build(rootFlow = FlowBuilder.prototype) {
    const story = {};

    const genTextTemplate = ({ text, ...rest }) => ({ duration: text.length * 50, timeout: 500, text, ...rest });
    const buildFlow = (flow) => {
      if (story[flow.id]) {
        return;
      }

      const flowId = flow.id;
      const texts = flow._texts.map((item) => genTextTemplate(item));
      const nextId = flow._next?.id;
      const conds = flow._conds.map((c) => {
        const [k, o, v, f] = c;
        buildFlow(f);
        return [k, o, v, f.id];
      });
      const effects = flow._effects;

      story[flowId] = { id: flowId, texts, nextId, effects, conds };

      if (nextId) {
        buildFlow(flow._next);
      }

      const actions = [];
      for (const button of flow._buttons) {
        const btnFlowId = `btn_${button.id}`;
        let btnNextId = button._next?.id;

        const action = {
          id: button.id,
          type: ACTION_TYPES.button,
          label: button._label,
          cond: {
            ...(Object.keys(button._andCond).length > 0 && { and: button._andCond }),
            ...(Object.keys(button._orCond).length > 0 && { or: button._orCond }),
          },
          effects: button._effects,
          nextId: btnNextId,
        };

        if (button._texts.length > 0) {
          story[btnFlowId] = {
            id: btnFlowId,
            texts: button._texts.map((item) => genTextTemplate(item)),
            nextId: btnNextId,
            conds: [],
            effects: [],
          };
          action.nextId = btnFlowId;
        }

        actions.push(action);

        if (button._next?.id) {
          buildFlow(button._next);
        }
      }

      story[flowId].actions = actions;
    };

    this._ctx.build();
    buildFlow(rootFlow);

    return story;
  }
}

const CLONE_WHEN_FREEZED = true;

class FreezedError extends Error {
  constructor(builder) {
    super(`Builder${builder._name ? ` '${builder._name}' ` : ' '}is freezed and can be used only as template`);
  }
}

export class FlowBuilder {
  /**
   *
   * @param {{ factory: StoryFactory }} args
   */
  constructor({ factory, name = '', prev, originalId }) {
    this.id = `${name}_${uuid()}`;
    this._name = name;
    this._buttons = [];
    this._texts = [];
    this._next = null;
    this._freezed = false;
    this._prev = prev;
    this._factory = factory;
    this._effects = [];
    this._conds = [];
    this._originalId = originalId;
  }

  // addPrev(prev) {
  //   this._prevs.add(prev);
  //   return this;
  // }

  freeze(root = this.head()) {
    root._freezed = true;
    root._next?.freeze(root._next);
    return this;
  }

  unfreeze(root = this.head()) {
    root._freezed = true;
    root._next?.freeze(root._next);
    return this;
  }

  /**
   *
   * @returns {FlowBuilder}
   */
  button(button) {
    if (this._freezed) {
      if (!CLONE_WHEN_FREEZED) {
        throw new FreezedError(this);
      }

      return this.clone().button(button);
    }
    this._buttons.push(button);

    button.setParent(this);
    return this;
  }

  /**
   *
   * @returns {FlowBuilder}
   */
  retext(...texts) {
    if (this._freezed) {
      if (!CLONE_WHEN_FREEZED) {
        throw new FreezedError(this);
      }

      return this.clone().retext(...texts);
    }

    let addings = texts;
    if (texts.length === 1 && Array.isArray(texts[0])) {
      addings = texts[0];
    }

    this._texts = addings.map((text) => (typeof text === 'string' ? { text } : text));
    return this;
  }

  /**
   *
   * @returns {FlowBuilder}
   */
  text(...texts) {
    if (this._freezed) {
      if (!CLONE_WHEN_FREEZED) {
        throw new FreezedError(this);
      }

      return this.clone().text(...texts);
    }

    let addings = texts;
    if (texts.length === 1 && Array.isArray(texts[0])) {
      addings = texts[0];
    }

    this._texts.push(...addings.map((text) => (typeof text === 'string' ? { text } : text)));
    return this;
  }

  /**
   *
   * @returns {FlowBuilder}
   */
  pretext(...texts) {
    if (this._freezed) {
      if (!CLONE_WHEN_FREEZED) {
        throw new FreezedError(this);
      }

      return this.clone().pretext(...texts);
    }
    let addings = texts;
    if (texts.length === 1 && Array.isArray(texts[0])) {
      addings = texts[0];
    }
    this._texts = [...addings.map((text) => (typeof text === 'string' ? { text } : text)), ...this._texts];
    return this;
  }

  /**
   * @param {string | FlowBuilder | () => FlowBuilder} flow
   * @returns {FlowBuilder}
   */
  to(flow /*, cb*/) {
    if (this._freezed) {
      if (!CLONE_WHEN_FREEZED) {
        throw new FreezedError(this);
      }

      const clone = this.clone().to(flow /*, cb*/);
      // this._prev._next = clone;
      return clone;
    }

    let nextFlow = flow;
    if (typeof nextFlow === 'function') {
      this._factory._ctx.addTarget(this, flow);
      return this;
    }

    if (typeof nextFlow === 'string') {
      nextFlow = this.get(nextFlow);
    }

    if (nextFlow._freezed) {
      nextFlow = nextFlow.clone();
    }

    if (nextFlow.id === this.id) {
      throw new Error('Unable to assign next flow to self');
    }

    // this.prev()?.to(this);
    nextFlow = nextFlow.from(this);
    this._next = nextFlow;

    return this;
  }

  from(flow) {
    if (this._freezed) {
      return this.clone().from(flow);
    }

    this._prev = flow;
    return this;
  }

  /**
   *
   * @param {string} key
   * @returns {FlowBuilder}
   */
  get(key) {
    const t = this._factory._ctx.getTarget(key);
    if (!t) {
      throw new Error(`Flow by name '${key}' not found`);
    }

    return t;
  }

  /**
   *
   * @param {string} key
   * @param {any} value
   * @returns {FlowBuilder}
   */
  set(key, value) {
    if (this._freezed) {
      if (!CLONE_WHEN_FREEZED) {
        throw new FreezedError(this);
      }

      return this.clone().set(key, value);
    }

    this._effects.push([key, 'set', value]);
    return this;
  }

  /**
   *
   * @param {string} key
   * @param {any} value
   * @returns {FlowBuilder}
   */
  add(key, value = 1) {
    if (this._freezed) {
      if (!CLONE_WHEN_FREEZED) {
        throw new FreezedError(this);
      }

      return this.clone().add(key, value);
    }

    this._effects.push([key, 'add', value]);
    return this;
  }

  /**
   *
   * @param {string} key
   * @param {string} op
   * @param {any} value
   * @param {FlowBuilder | (b: FlowBuilder) => FlowBuilder} flow
   * @returns
   */
  if(key, op, value, flow) {
    if (typeof flow === 'function') {
      this._factory._ctx.addTarget(this, (b) => {
        return b.if(key, op, value, flow(b.clone()));
      });
      return this;
    }

    this._conds.push([key, op, value, flow]);
    return this;
  }

  // /**
  //  *
  //  * @param {((f: FlowBuilder) => FlowBuilder) | undefined} cb
  //  * @returns
  //  */
  // toNext(cb) {
  //   return this.to(this._next._next, cb);
  // }

  // /**
  //  *
  //  * @param {((f: FlowBuilder) => FlowBuilder) | undefined} cb
  //  * @returns
  //  */
  // toPrev(cb) {
  //   return this.to(this._parent, cb);
  // }

  /**
   *
   * @returns {FlowBuilder}
   */
  join(flow = this._factory.flowFactory()) {
    let nextFlow = flow;
    if (typeof nextFlow === 'string') {
      nextFlow = this._factory.flowFactory(nextFlow);
    }
    if (typeof nextFlow === 'function') {
      this._factory._ctx.addTarget(this, nextFlow);
      return this;
    }

    const next = this.to(nextFlow)._next;

    return next;
  }

  /**
   * 
   * @param {FlowBuilder | (f: FlowBuilder) => FlowBuilder} flow 
   * @returns {FlowBuilder}
   */
  returns(flow) {
    if (this._freezed) {
      if (!CLONE_WHEN_FREEZED) {
        throw new FreezedError(this);
      }

      // if (this._name === 'to_reset') {
      //   debugger;
      // }

      return this.clone().returns(flow);
    }

    // if (this._name === 'to_reset') {
    //   debugger;
    // }

    if (typeof flow === 'function') {
      this._factory._ctx.addTarget(this, (f) => this.returns(flow(f)));
      return this;
    }

    let nextFlow = flow;
    if (typeof nextFlow === 'string') {
      nextFlow = this.get(nextFlow);
    }

    if (!this._next) {
      throw new Error('Unable to attach returns: current next is null');
    }

    const prevNext = this._next;
    const target = flow._freezed ? flow.clone() : flow;
    const self = this.to(target);
    const latest = self.tail();
    latest.to(prevNext);
    if (this._prev) {
      this._prev._next = self;
    }

    return self;
  }

  /**
   *
   * @returns {FlowBuilder}
   */
  prev() {
    return this._prev;
  }

  /**
   *
   * @returns {FlowBuilder}
   */
  next() {
    return this._next;
  }

  head() {
    const ids = new Set();
    const walkUp = (f) => {
      if (ids.has(f.id)) {
        return f;
      }

      ids.add(f.id);
      if (f._prev) {
        return walkUp(f._prev);
      } else {
        return f;
      }
    };

    return walkUp(this);
  }

  tail() {
    const ids = new Set();
    const walkDown = (f) => {
      if (ids.has(f.id)) {
        return f;
      }

      ids.add(f.id);
      if (f._next) {
        return walkDown(f._next);
      } else {
        return f;
      }
    };

    return walkDown(this);
  }

  /**
   *
   * @returns {FlowBuilder}
   */
  clone() {
    return this._factory.flowFactory.clone(this);
  }
}

export class ButtonBuilder {
  /**
   *
   * @param {{ factory: StoryFactory }} param0
   */
  constructor({ factory, name = '' }) {
    this.id = `${name}_${uuid()}`;
    this._name = name;
    this._texts = [];
    this._next = null;
    this._label = '???';
    this._freezed = false;
    this._effects = [];
    this._andCond = {};
    this._orCond = {};
    this._parent = null;
    this._factory = factory;
  }

  setParent(flow) {
    this._parent = flow;
    return this;
  }

  freeze() {
    this._freezed = true;
    return this;
  }

  and(key, op, value) {
    if (this._freezed) {
      throw new FreezedError(this);
    }

    this._andCond[key] = [op, value];

    return this;
  }

  or(key, op, value) {
    if (this._freezed) {
      throw new FreezedError(this);
    }

    this._orCond[key] = [op, value];

    return this;
  }

  set(key, value) {
    if (this._freezed) {
      throw new FreezedError(this);
    }

    this._effects.push([key, 'set', value]);
    return this;
  }

  add(key, value = 1) {
    if (this._freezed) {
      throw new FreezedError(this);
    }

    this._effects.push([key, 'add', value]);
    return this;
  }

  label(label) {
    if (this._freezed) {
      throw new FreezedError(this);
    }
    this._label = label;
    return this;
  }

  retext(...texts) {
    if (this._freezed) {
      throw new FreezedError(this);
    }

    let addings = texts;
    if (texts.length === 1 && Array.isArray(texts[0])) {
      addings = texts[0];
    }

    this._texts = addings.map((text) => (typeof text === 'string' ? { text } : text));
    return this;
  }

  pretext(...texts) {
    if (this._freezed) {
      throw new FreezedError(this);
    }

    let addings = texts;
    if (texts.length === 1 && Array.isArray(texts[0])) {
      addings = texts[0];
    }

    this._texts.unshift(...addings.map((text) => (typeof text === 'string' ? { text } : text)));

    return this;
  }

  text(...texts) {
    if (this._freezed) {
      throw new FreezedError(this);
    }

    let addings = texts;
    if (texts.length === 1 && Array.isArray(texts[0])) {
      addings = texts[0];
    }

    this._texts.push(...addings.map((text) => (typeof text === 'string' ? { text } : text)));

    return this;
  }

  /**
   *
   * @param {string} key
   * @returns {FlowBuilder}
   */
  get(key) {
    const t = this._factory._ctx.getTarget(key);
    if (!t) {
      throw new Error(`Flow by name '${key}' not found`);
    }

    return t;
  }

  // bind(flow) {
  //   const builder = this.clone();
  //   builder.to(flow);

  //   return builder;
  // }

  /**
   * Assigns next flow
   * @param {FlowBuilder | string} flow
   * @param {(b: FlowBuilder) => FlowBuilder} cb
   * @returns {ButtonBuilder}
   */
  to(flow) {
    if (this._freezed) {
      throw new FreezedError(this);
    }

    let nextFlow = flow;
    if (typeof flow === 'string') {
      nextFlow = this.get(nextFlow);
    }

    this._next = nextFlow._freezed ? nextFlow.clone() : nextFlow;

    return this;
  }

  /**
   * Assigns next flow
   * @param {FlowBuilder | string} flow
   * @param {(b: FlowBuilder) => FlowBuilder} cb
   * @returns {FlowBuilder}
   */
  join(flow = this._factory.flowFactory()) {
    let nextFlow = flow;
    if (typeof nextFlow === 'string') {
      nextFlow = this._factory.flowFactory(nextFlow);
    }
    return this.to(flow)._next;
  }

  // /**
  //  *
  //  * @param {((f: FlowBuilder) => FlowBuilder) | undefined} cb
  //  * @returns
  //  */
  // toNext(cb) {
  //   return this.to(this._parent._next, cb);
  // }

  // /**
  //  *
  //  * @param {((f: FlowBuilder) => FlowBuilder) | undefined} cb
  //  * @returns
  //  */
  // toPrev(cb) {
  //   return this.to(this._parent, cb);
  // }

  /**
   *
   *
   * @returns {FlowBuilder}
   */
  parent() {
    return this._parent;
  }

  /**Failed
   *
   *
   * @returns {FlowBuilder}
   */
  next() {
    return this._next;
  }

  /**
   *
   *
   * @returns {ButtonBuilder}
   */
  clone() {
    return this._factory.flowFactory.clone(this);
  }
}

export const ACTION_TYPES = {
  button: 'button',
};

export class TextBuilder {
  defaults = { _ms: 50, _timeout: 500 };
  constructor() {
    Object.assign(this, this.defaults);
  }
  wait(ms) {
    this._timeout = ms ?? this.defaults._timeout;
    return this;
  }
  ms(ms) {
    this._ms = ms;
    this._duration = null;
    return this;
  }
  duration(ms) {
    this._duration = ms;
    this._ms = null;
    return this;
  }
  build(text) {
    return {
      text,
      duration: this._duration ?? this._ms * text.length,
      timeout: this._timeout,
    };
  }
}

TextBuilder.wait = (...args) => new TextBuilder().wait(...args);
TextBuilder.ms = (...args) => new TextBuilder().ms(...args);
TextBuilder.build = (...args) => new TextBuilder().build(...args);
TextBuilder.text = (strings, ...templates) => {
  const items = [];
  for (let i = 0; i < strings.length; i += 1) {
    const text = strings[i];
    const isEmpty = text.trim().length === 0;
    if (isEmpty) {
      continue;
    }

    const item = templates[i]?.build(text) ?? TextBuilder.build(text);

    items.push(item);
  }
  return items;
};
