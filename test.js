'use strict';

const assert = require('assert');
const ConditionallyExecute = require('./');

// ---------------------------------------------------------------------------
// Basic functionality
// ---------------------------------------------------------------------------

describe('basic functionality', function () {
  it('should execute onFalse when condition is falsy', async function () {
    let wasOnTrueExecuted = false;
    let wasOnFalseExecuted = false;

    await new ConditionallyExecute()
      .onTrue(() => { wasOnTrueExecuted = true; })
      .onFalse(() => { wasOnFalseExecuted = true; })
      .condition(1 === 2)
      .execute();

    assert.equal(wasOnFalseExecuted, true);
    assert.equal(wasOnTrueExecuted, false);
  });

  it('should execute onTrue when condition is truthy', async function () {
    let wasOnTrueExecuted = false;
    let wasOnFalseExecuted = false;

    await new ConditionallyExecute()
      .onTrue(() => { wasOnTrueExecuted = true; })
      .onFalse(() => { wasOnFalseExecuted = true; })
      .condition(1 === 1)
      .execute();

    assert.equal(wasOnFalseExecuted, false);
    assert.equal(wasOnTrueExecuted, true);
  });

  it('should execute onTrue when no condition is set (default true)', async function () {
    let wasOnTrueExecuted = false;
    let wasOnFalseExecuted = false;

    await new ConditionallyExecute()
      .onTrue(() => { wasOnTrueExecuted = true; })
      .onFalse(() => { wasOnFalseExecuted = true; })
      .execute();

    assert.equal(wasOnFalseExecuted, false);
    assert.equal(wasOnTrueExecuted, true);
  });
});

// ---------------------------------------------------------------------------
// Extended functionality
// ---------------------------------------------------------------------------

describe('extended functionality', function () {
  it('should execute all onFalse functions when condition is falsy', async function () {
    let wasOnTrueExecuted = false;
    let wasOnFalseExecuted = false;
    let wasSecondOnFalseExecuted = false;

    await new ConditionallyExecute()
      .onTrue(() => { wasOnTrueExecuted = true; })
      .onFalse(() => { wasOnFalseExecuted = true; })
      .onFalse(() => { wasSecondOnFalseExecuted = true; })
      .condition(1 === 2)
      .execute();

    assert.equal(wasOnFalseExecuted, true);
    assert.equal(wasSecondOnFalseExecuted, true);
    assert.equal(wasOnTrueExecuted, false);
  });

  it('should execute all onTrue functions when condition is truthy', async function () {
    let wasOnTrueExecuted = false;
    let wasSecondOnTrueExecuted = false;
    let wasOnFalseExecuted = false;

    await new ConditionallyExecute()
      .onTrue(() => { wasOnTrueExecuted = true; })
      .onTrue(() => { wasSecondOnTrueExecuted = true; })
      .onFalse(() => { wasOnFalseExecuted = true; })
      .execute();

    assert.equal(wasOnFalseExecuted, false);
    assert.equal(wasOnTrueExecuted, true);
    assert.equal(wasSecondOnTrueExecuted, true);
  });

  it('should execute all onTrue functions when no condition is set', async function () {
    let wasOnTrueExecuted = false;
    let wasSecondOnTrueExecuted = false;
    let wasOnFalseExecuted = false;

    await new ConditionallyExecute()
      .onTrue(() => { wasOnTrueExecuted = true; })
      .onTrue(() => { wasSecondOnTrueExecuted = true; })
      .onFalse(() => { wasOnFalseExecuted = true; })
      .execute();

    assert.equal(wasOnFalseExecuted, false);
    assert.equal(wasOnTrueExecuted, true);
    assert.equal(wasSecondOnTrueExecuted, true);
  });
});

// ---------------------------------------------------------------------------
// condition() semantics
// ---------------------------------------------------------------------------

describe('condition() semantics', function () {
  it('should coerce non-boolean truthy values to true', async function () {
    let branch = null;

    await new ConditionallyExecute()
      .condition('non-empty string')
      .onTrue(() => { branch = 'true'; })
      .onFalse(() => { branch = 'false'; })
      .execute();

    assert.equal(branch, 'true');
  });

  it('should coerce non-boolean falsy values to false', async function () {
    let branch = null;

    for (const falsy of [0, '', null, undefined, NaN]) {
      branch = null;
      await new ConditionallyExecute()
        .condition(falsy)
        .onTrue(() => { branch = 'true'; })
        .onFalse(() => { branch = 'false'; })
        .execute();
      assert.equal(branch, 'false', `Expected false for condition(${String(falsy)})`);
    }
  });

  it('should use last condition() call when called multiple times', async function () {
    let branch = null;

    await new ConditionallyExecute()
      .condition(false)
      .condition(true)   // last call wins
      .onTrue(() => { branch = 'true'; })
      .onFalse(() => { branch = 'false'; })
      .execute();

    assert.equal(branch, 'true');
  });
});

// ---------------------------------------------------------------------------
// Async handlers
// ---------------------------------------------------------------------------

describe('async handlers', function () {
  it('should await async onTrue handlers', async function () {
    let result = false;

    await new ConditionallyExecute()
      .condition(true)
      .onTrue(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        result = true;
      })
      .execute();

    assert.equal(result, true);
  });

  it('should await async onFalse handlers', async function () {
    let result = false;

    await new ConditionallyExecute()
      .condition(false)
      .onFalse(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        result = true;
      })
      .execute();

    assert.equal(result, true);
  });

  it('should run multiple async handlers concurrently', async function () {
    const order = [];

    await new ConditionallyExecute()
      .condition(true)
      .onTrue(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        order.push('slow');
      })
      .onTrue(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        order.push('fast');
      })
      .execute();

    assert.equal(order.length, 2);
    assert.ok(order.includes('slow'));
    assert.ok(order.includes('fast'));
  });

  it('should propagate rejections from async handlers', async function () {
    await assert.rejects(
      () => new ConditionallyExecute()
        .condition(true)
        .onTrue(async () => { throw new Error('boom'); })
        .execute(),
      /boom/
    );
  });
});

// ---------------------------------------------------------------------------
// executeSync()
// ---------------------------------------------------------------------------

describe('executeSync()', function () {
  it('should execute onTrue synchronously when condition is true', function () {
    let called = false;
    new ConditionallyExecute()
      .condition(true)
      .onTrue(() => { called = true; })
      .executeSync();
    assert.equal(called, true);
  });

  it('should execute onFalse synchronously when condition is false', function () {
    let called = false;
    new ConditionallyExecute()
      .condition(false)
      .onFalse(() => { called = true; })
      .executeSync();
    assert.equal(called, true);
  });

  it('should not execute onFalse when condition is true (sync)', function () {
    let called = false;
    new ConditionallyExecute()
      .condition(true)
      .onTrue(() => {})
      .onFalse(() => { called = true; })
      .executeSync();
    assert.equal(called, false);
  });

  it('should execute multiple handlers in registration order (sync)', function () {
    const order = [];
    new ConditionallyExecute()
      .condition(true)
      .onTrue(() => { order.push(1); })
      .onTrue(() => { order.push(2); })
      .onTrue(() => { order.push(3); })
      .executeSync();
    assert.deepEqual(order, [1, 2, 3]);
  });

  it('should respect dryRun option (sync)', function () {
    let called = false;
    new ConditionallyExecute({ dryRun: true })
      .condition(true)
      .onTrue(() => { called = true; })
      .executeSync();
    assert.equal(called, false);
  });
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe('input validation', function () {
  it('should throw TypeError when onTrue receives a non-function', function () {
    assert.throws(
      () => new ConditionallyExecute().onTrue('not a function'),
      TypeError
    );
  });

  it('should throw TypeError when onFalse receives a non-function', function () {
    assert.throws(
      () => new ConditionallyExecute().onFalse(42),
      TypeError
    );
  });

  it('should throw TypeError for null passed to onTrue', function () {
    assert.throws(
      () => new ConditionallyExecute().onTrue(null),
      TypeError
    );
  });

  it('should throw TypeError when use() receives a non-function', function () {
    assert.throws(
      () => new ConditionallyExecute().use('not a middleware'),
      TypeError
    );
  });

  it('should throw TypeError when onError() receives a non-function', function () {
    assert.throws(
      () => new ConditionallyExecute().onError(123),
      TypeError
    );
  });
});

// ---------------------------------------------------------------------------
// timeout option
// ---------------------------------------------------------------------------

describe('timeout option', function () {
  it('should throw TimeoutError when handler exceeds timeout', async function () {
    await assert.rejects(
      () => new ConditionallyExecute({ timeout: 50 })
        .condition(true)
        .onTrue(async () => new Promise((r) => setTimeout(r, 200)))
        .execute(),
      (err) => {
        assert.ok(err instanceof ConditionallyExecute.TimeoutError);
        assert.match(err.message, /50ms/);
        return true;
      }
    );
  });

  it('should not throw when handler completes within timeout', async function () {
    let ran = false;
    await new ConditionallyExecute({ timeout: 500 })
      .condition(true)
      .onTrue(async () => {
        await new Promise((r) => setTimeout(r, 10));
        ran = true;
      })
      .execute();
    assert.equal(ran, true);
  });
});

// ---------------------------------------------------------------------------
// retry option
// ---------------------------------------------------------------------------

describe('retry option', function () {
  it('should retry failing handlers up to n times', async function () {
    let attempts = 0;
    await new ConditionallyExecute({ retry: 2 })
      .condition(true)
      .onTrue(async () => {
        attempts++;
        if (attempts < 3) throw new Error('transient failure');
      })
      .execute();
    assert.equal(attempts, 3); // 1 initial + 2 retries
  });

  it('should throw after exhausting retries', async function () {
    let attempts = 0;
    await assert.rejects(
      () => new ConditionallyExecute({ retry: 1 })
        .condition(true)
        .onTrue(() => { attempts++; throw new Error('always fails'); })
        .execute(),
      /always fails/
    );
    assert.equal(attempts, 2); // 1 initial + 1 retry
  });
});

// ---------------------------------------------------------------------------
// dryRun option
// ---------------------------------------------------------------------------

describe('dryRun option', function () {
  it('should not execute handlers when dryRun is true', async function () {
    let called = false;
    await new ConditionallyExecute({ dryRun: true })
      .condition(true)
      .onTrue(() => { called = true; })
      .execute();
    assert.equal(called, false);
  });
});

// ---------------------------------------------------------------------------
// onError()
// ---------------------------------------------------------------------------

describe('onError()', function () {
  it('should call onError instead of throwing when handler fails', async function () {
    let caughtError = null;
    await new ConditionallyExecute()
      .condition(true)
      .onTrue(() => { throw new Error('handler blew up'); })
      .onError((err) => { caughtError = err; })
      .execute();
    assert.ok(caughtError instanceof Error);
    assert.match(caughtError.message, /handler blew up/);
  });

  it('should call onError with TimeoutError on timeout', async function () {
    let caughtError = null;
    await new ConditionallyExecute({ timeout: 30 })
      .condition(true)
      .onTrue(async () => new Promise((r) => setTimeout(r, 200)))
      .onError((err) => { caughtError = err; })
      .execute();
    assert.ok(caughtError instanceof ConditionallyExecute.TimeoutError);
  });
});

// ---------------------------------------------------------------------------
// Middleware (.use())
// ---------------------------------------------------------------------------

describe('middleware (.use())', function () {
  it('should call middleware before handler execution', async function () {
    const log = [];

    await new ConditionallyExecute()
      .use(async (ctx, next) => {
        log.push('before');
        await next();
        log.push('after');
      })
      .condition(true)
      .onTrue(() => { log.push('handler'); })
      .execute();

    assert.deepEqual(log, ['before', 'handler', 'after']);
  });

  it('should allow middleware to override condition', async function () {
    let branch = null;

    const overrideToFalse = async (ctx, next) => {
      ctx.condition = false;
      ctx.branch = 'onFalse';
      ctx.handlers = ctx._onFalse;
      await next();
    };

    await new ConditionallyExecute()
      .use(overrideToFalse)
      .condition(true)  // original: true
      .onTrue(() => { branch = 'true'; })
      .onFalse(() => { branch = 'false'; })
      .execute();

    assert.equal(branch, 'false');  // middleware overrode it
  });

  it('should compose multiple middlewares in order', async function () {
    const log = [];

    await new ConditionallyExecute()
      .use(async (ctx, next) => { log.push('mw1-in'); await next(); log.push('mw1-out'); })
      .use(async (ctx, next) => { log.push('mw2-in'); await next(); log.push('mw2-out'); })
      .condition(true)
      .onTrue(() => { log.push('handler'); })
      .execute();

    assert.deepEqual(log, ['mw1-in', 'mw2-in', 'handler', 'mw2-out', 'mw1-out']);
  });
});

// ---------------------------------------------------------------------------
// Named condition registry
// ---------------------------------------------------------------------------

describe('named condition registry', function () {
  afterEach(function () {
    ConditionallyExecute.clearRegistry();
  });

  it('should evaluate a registered condition by name', async function () {
    ConditionallyExecute.register('alwaysTrue', () => true);

    let branch = null;
    await new ConditionallyExecute()
      .condition('alwaysTrue')
      .onTrue(() => { branch = 'true'; })
      .onFalse(() => { branch = 'false'; })
      .execute();

    assert.equal(branch, 'true');
  });

  it('should support dynamic registered conditions', async function () {
    let value = false;
    ConditionallyExecute.register('dynamic', () => value);

    let branch = null;

    await new ConditionallyExecute()
      .condition('dynamic')
      .onTrue(() => { branch = 'true'; })
      .onFalse(() => { branch = 'false'; })
      .execute();
    assert.equal(branch, 'false');

    value = true;
    await new ConditionallyExecute()
      .condition('dynamic')
      .onTrue(() => { branch = 'true'; })
      .onFalse(() => { branch = 'false'; })
      .execute();
    assert.equal(branch, 'true');
  });

  it('should throw TypeError for invalid register() arguments', function () {
    assert.throws(() => ConditionallyExecute.register(123, () => {}), TypeError);
    assert.throws(() => ConditionallyExecute.register('name', 'not-a-fn'), TypeError);
  });
});

// ---------------------------------------------------------------------------
// collectErrors option
// ---------------------------------------------------------------------------

describe('collectErrors option', function () {
  it('should collect all handler errors into AggregateError', async function () {
    await assert.rejects(
      () => new ConditionallyExecute({ collectErrors: true })
        .condition(true)
        .onTrue(() => { throw new Error('err1'); })
        .onTrue(() => { throw new Error('err2'); })
        .execute(),
      (err) => {
        assert.ok(err instanceof AggregateError);
        assert.equal(err.errors.length, 2);
        return true;
      }
    );
  });
});
