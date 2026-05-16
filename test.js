'use strict';


const assert = require('assert');
const ConditionallyExecute = require('./');

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

    // Both ran — order is not guaranteed (concurrent)
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
});

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
});
