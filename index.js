'use strict';

/**
 * @typedef {() => void | Promise<void>} Handler
 * A synchronous or asynchronous handler function.
 */

/**
 * ConditionallyExecute — enterprise-grade if-statement replacement.
 *
 * @example
 * // Async (default)
 * await new ConditionallyExecute()
 *   .condition(user.isAdmin)
 *   .onTrue(() => grantAccess())
 *   .onFalse(() => denyAccess())
 *   .execute();
 *
 * @example
 * // Sync (no Promise overhead)
 * new ConditionallyExecute()
 *   .condition(user.isAdmin)
 *   .onTrue(() => grantAccess())
 *   .executeSync();
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
   * Sets the condition. Coerced to boolean. Last call wins.
   * Defaults to `true` if never called.
   * @param {unknown} condition
   * @returns {this}
   */
  condition(condition) {
    this._condition = Boolean(condition);
    return this;
  }

  /**
   * Registers a handler for the truthy branch.
   * @param {Handler} func
   * @returns {this}
   * @throws {TypeError} If func is not a function.
   */
  onTrue(func) {
    if (typeof func !== 'function') {
      throw new TypeError(`onTrue() expects a function, got ${typeof func}`);
    }
    this._onTrue.push(func);
    return this;
  }

  /**
   * Registers a handler for the falsy branch.
   * @param {Handler} func
   * @returns {this}
   * @throws {TypeError} If func is not a function.
   */
  onFalse(func) {
    if (typeof func !== 'function') {
      throw new TypeError(`onFalse() expects a function, got ${typeof func}`);
    }
    this._onFalse.push(func);
    return this;
  }

  /**
   * Executes all active-branch handlers concurrently.
   * Supports async handlers. Must be the last call in the chain.
   * @returns {Promise<void>}
   */
  async execute() {
    const handlers = this._condition ? this._onTrue : this._onFalse;
    await Promise.all(handlers.map((fn) => fn()));
  }

  /**
   * Executes all active-branch handlers synchronously, in registration order.
   * Use this when all handlers are synchronous and you need minimal overhead.
   * If a handler returns a Promise it is NOT awaited — use `.execute()` instead.
   * @returns {void}
   */
  executeSync() {
    const handlers = this._condition ? this._onTrue : this._onFalse;
    for (let i = 0; i < handlers.length; i++) {
      handlers[i]();
    }
  }
}

module.exports = ConditionallyExecute;
