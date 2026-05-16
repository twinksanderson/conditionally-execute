'use strict';

/**
 * @typedef {(...args: unknown[]) => unknown | Promise<unknown>} Handler
 * A synchronous or asynchronous callback function.
 */

/**
 * ConditionallyExecute — enterprise-grade if-statement replacement.
 *
 * Provides a fluent builder API for conditional execution of callbacks.
 * Supports multiple handlers per branch, async handlers, and arbitrary
 * chaining order (as long as `.execute()` is called last).
 *
 * @example
 * // Basic usage
 * await new ConditionallyExecute()
 *   .condition(user.isAdmin)
 *   .onTrue(() => grantAccess())
 *   .onFalse(() => denyAccess())
 *   .execute();
 *
 * @example
 * // Async handlers
 * await new ConditionallyExecute()
 *   .condition(await checkDatabase())
 *   .onTrue(async () => { await sendWelcomeEmail(); })
 *   .execute();
 *
 * @example
 * // Default condition (true) — onTrue fires without calling .condition()
 * await new ConditionallyExecute()
 *   .onTrue(() => console.log('always runs'))
 *   .execute();
 */
class ConditionallyExecute {
  constructor() {
    /** @private @type {boolean} */
    this._condition = true;

    /** @private @type {Handler[]} */
    this._onTrue = [];

    /** @private @type {Handler[]} */
    this._onFalse = [];
  }

  /**
   * Sets the condition that determines which branch to execute.
   * The value is coerced to boolean via `Boolean()`. Calling this
   * multiple times overwrites the previous condition — last call wins.
   *
   * If `.condition()` is never called, defaults to `true`.
   *
   * @param {unknown} condition - Any value; coerced to boolean.
   * @returns {this}
   */
  condition(condition) {
    this._condition = Boolean(condition);
    return this;
  }

  /**
   * Registers a handler to execute when the condition is truthy.
   * Multiple handlers are supported and run concurrently on execute.
   *
   * @param {Handler} func - Function to call. May be async.
   * @returns {this}
   * @throws {TypeError} If `func` is not a function.
   */
  onTrue(func) {
    if (typeof func !== 'function') {
      throw new TypeError(
        `onTrue() expects a function, got ${typeof func}`
      );
    }
    this._onTrue.push(func);
    return this;
  }

  /**
   * Registers a handler to execute when the condition is falsy.
   * Multiple handlers are supported and run concurrently on execute.
   *
   * @param {Handler} func - Function to call. May be async.
   * @returns {this}
   * @throws {TypeError} If `func` is not a function.
   */
  onFalse(func) {
    if (typeof func !== 'function') {
      throw new TypeError(
        `onFalse() expects a function, got ${typeof func}`
      );
    }
    this._onFalse.push(func);
    return this;
  }

  /**
   * Executes all registered handlers for the active branch concurrently.
   *
   * If any handler throws synchronously or returns a rejected Promise,
   * the returned Promise rejects with that error.
   *
   * Must be the last call in the chain.
   *
   * @returns {Promise<void>}
   */
  async execute() {
    const handlers = this._condition ? this._onTrue : this._onFalse;
    await Promise.all(handlers.map((fn) => fn()));
  }
}

module.exports = ConditionallyExecute;
