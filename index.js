'use strict';

// ---------------------------------------------------------------------------
// Custom error types
// ---------------------------------------------------------------------------

class ConditionallyExecuteError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConditionallyExecuteError';
  }
}

class TimeoutError extends ConditionallyExecuteError {
  constructor(ms) {
    super(`Handler execution timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

// ---------------------------------------------------------------------------
// Named condition registry
// ---------------------------------------------------------------------------

/** @type {Map<string, () => unknown>} */
const _registry = new Map();

// ---------------------------------------------------------------------------
// Main class
// ---------------------------------------------------------------------------

/**
 * @typedef {() => void | Promise<void>} Handler
 * A synchronous or asynchronous handler function.
 */

/**
 * @typedef {object} ConditionallyExecuteOptions
 * @property {boolean} [collectErrors=false]  Collect all handler errors into AggregateError instead of short-circuiting.
 * @property {boolean} [dryRun=false]         Log what would execute, but don't call handlers.
 * @property {number|null} [timeout=null]     Abort execution after N ms; throws TimeoutError.
 * @property {number} [retry=0]               Retry failing handlers up to N times.
 * @property {'none'|'linear'|'exponential'} [backoff='none']  Backoff strategy between retries.
 * @property {boolean} [auditLog=false]       Log condition, branch, handler count, and duration to stdout.
 */

/**
 * @typedef {object} ExecutionContext
 * @property {boolean} condition   Current condition value (may be mutated by middleware).
 * @property {string}  branch      Active branch: 'onTrue' | 'onFalse'.
 * @property {Handler[]} handlers  Active handlers (may be mutated by middleware).
 * @property {Handler[]} _onTrue   All registered onTrue handlers.
 * @property {Handler[]} _onFalse  All registered onFalse handlers.
 * @property {ConditionallyExecuteOptions} options
 */

/**
 * @callback Middleware
 * @param {ExecutionContext} ctx
 * @param {() => Promise<void>} next
 * @returns {Promise<void>}
 */

/**
 * ConditionallyExecute — enterprise-grade if-statement replacement.
 *
 * @example
 * // Basic async
 * await new ConditionallyExecute()
 *   .condition(user.isAdmin)
 *   .onTrue(() => grantAccess())
 *   .onFalse(() => denyAccess())
 *   .execute();
 *
 * @example
 * // With timeout + retry
 * await new ConditionallyExecute({ timeout: 5000, retry: 3, backoff: 'exponential' })
 *   .condition(isHealthy)
 *   .onTrue(deployToProduction)
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
  /**
   * @param {ConditionallyExecuteOptions} [options]
   */
  constructor(options = {}) {
    /** @private @type {boolean} */
    this._condition = true;
    /** @private @type {Handler[]} */
    this._onTrue = [];
    /** @private @type {Handler[]} */
    this._onFalse = [];
    /** @private @type {Middleware[]} */
    this._middlewares = [];
    /** @private @type {((err: Error) => void | Promise<void>)|null} */
    this._errorHandler = null;
    /** @private */
    this._options = {
      collectErrors: false,
      dryRun: false,
      timeout: null,
      retry: 0,
      backoff: 'none',
      auditLog: false,
      ...options,
    };
  }

  // -------------------------------------------------------------------------
  // Static API
  // -------------------------------------------------------------------------

  /**
   * Register a named condition for reuse across instances.
   * @param {string} name
   * @param {() => unknown} fn
   */
  static register(name, fn) {
    if (typeof name !== 'string') throw new TypeError(`register() expects a string name, got ${typeof name}`);
    if (typeof fn !== 'function') throw new TypeError(`register() expects a function evaluator, got ${typeof fn}`);
    _registry.set(name, fn);
  }

  /**
   * Remove a named condition from the registry.
   * @param {string} name
   */
  static unregister(name) {
    _registry.delete(name);
  }

  /**
   * Clear the entire named condition registry.
   */
  static clearRegistry() {
    _registry.clear();
  }

  // -------------------------------------------------------------------------
  // Builder API
  // -------------------------------------------------------------------------

  /**
   * Sets the condition. Coerced to boolean. Last call wins.
   * Accepts a named condition string registered via `ConditionallyExecute.register()`.
   * Defaults to `true` if never called.
   * @param {unknown} condition
   * @returns {this}
   */
  condition(condition) {
    if (typeof condition === 'string' && _registry.has(condition)) {
      this._condition = Boolean(_registry.get(condition)());
    } else {
      this._condition = Boolean(condition);
    }
    return this;
  }

  /**
   * Registers a handler for the truthy branch.
   * @param {Handler} func
   * @returns {this}
   * @throws {TypeError}
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
   * @throws {TypeError}
   */
  onFalse(func) {
    if (typeof func !== 'function') {
      throw new TypeError(`onFalse() expects a function, got ${typeof func}`);
    }
    this._onFalse.push(func);
    return this;
  }

  /**
   * Registers an error handler. Called instead of throwing when a handler fails.
   * If not set, errors propagate normally.
   * @param {(err: Error) => void | Promise<void>} fn
   * @returns {this}
   */
  onError(fn) {
    if (typeof fn !== 'function') {
      throw new TypeError(`onError() expects a function, got ${typeof fn}`);
    }
    this._errorHandler = fn;
    return this;
  }

  /**
   * Registers a middleware. Middleware runs before handler execution and can
   * mutate the execution context (including `ctx.condition`, `ctx.branch`,
   * `ctx.handlers`). Call `next()` to continue the chain.
   *
   * @param {Middleware} middleware
   * @returns {this}
   * @example
   * .use(async (ctx, next) => {
   *   console.log('before:', ctx.condition);
   *   await next();
   *   console.log('after:', ctx.branch);
   * })
   */
  use(middleware) {
    if (typeof middleware !== 'function') {
      throw new TypeError(`use() expects a function middleware, got ${typeof middleware}`);
    }
    this._middlewares.push(middleware);
    return this;
  }

  // -------------------------------------------------------------------------
  // Execution
  // -------------------------------------------------------------------------

  /**
   * Executes all active-branch handlers concurrently via `Promise.all`.
   * Supports async handlers, middleware, timeout, retry, dryRun, and audit log.
   * Must be the last method call in the chain.
   * @returns {Promise<void>}
   */
  async execute() {
    /** @type {ExecutionContext} */
    const ctx = {
      condition: this._condition,
      branch: this._condition ? 'onTrue' : 'onFalse',
      handlers: this._condition ? this._onTrue : this._onFalse,
      _onTrue: this._onTrue,
      _onFalse: this._onFalse,
      options: this._options,
    };

    const startTime = this._options.auditLog ? performance.now() : 0;

    const runChain = async () => {
      const dispatch = async (index) => {
        if (index < this._middlewares.length) {
          await this._middlewares[index](ctx, () => dispatch(index + 1));
        } else {
          await this._executeHandlers(ctx);
        }
      };
      await dispatch(0);
    };

    try {
      if (this._options.timeout) {
        await Promise.race([
          runChain(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new TimeoutError(this._options.timeout)), this._options.timeout)
          ),
        ]);
      } else {
        await runChain();
      }
    } catch (err) {
      if (this._errorHandler) {
        await this._errorHandler(err);
        return;
      }
      throw err;
    }

    if (this._options.auditLog) {
      const duration = (performance.now() - startTime).toFixed(2);
      // eslint-disable-next-line no-console
      console.log(
        `[${new Date().toISOString()}] ConditionallyExecute: ` +
        `condition=${ctx.condition} branch=${ctx.branch} ` +
        `handlers=${ctx.handlers.length} duration=${duration}ms`
      );
    }
  }

  /**
   * Executes all active-branch handlers synchronously, in registration order.
   * No middleware support. No Promise overhead.
   * Use when all handlers are synchronous and performance matters.
   * @returns {void}
   */
  executeSync() {
    const handlers = this._condition ? this._onTrue : this._onFalse;

    if (this._options.dryRun) {
      // eslint-disable-next-line no-console
      console.log(
        `[DryRun] ConditionallyExecute: would execute ${handlers.length} ` +
        `handler(s) on branch ${this._condition ? 'onTrue' : 'onFalse'}`
      );
      return;
    }

    for (let i = 0; i < handlers.length; i++) {
      handlers[i]();
    }
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /** @private */
  async _executeHandlers(ctx) {
    if (ctx.options.dryRun) {
      // eslint-disable-next-line no-console
      console.log(
        `[DryRun] ConditionallyExecute: would execute ${ctx.handlers.length} ` +
        `handler(s) on branch ${ctx.branch}`
      );
      return;
    }

    const invoke = (fn) => this._invokeWithRetry(fn, ctx.options);

    if (ctx.options.collectErrors) {
      const results = await Promise.allSettled(ctx.handlers.map(invoke));
      const errors = results.filter((r) => r.status === 'rejected').map((r) => r.reason);
      if (errors.length > 0) {
        throw new AggregateError(errors, `${errors.length} handler(s) failed`);
      }
      return;
    }

    await Promise.all(ctx.handlers.map(invoke));
  }

  /** @private */
  async _invokeWithRetry(fn, options) {
    const maxRetries = options.retry || 0;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          const delay = ConditionallyExecute._backoffDelay(attempt, options.backoff);
          if (delay > 0) await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw lastError;
  }

  /** @private */
  static _backoffDelay(attempt, strategy) {
    switch (strategy) {
      case 'linear': return attempt * 100;
      case 'exponential': return Math.pow(2, attempt) * 100;
      default: return 0;
    }
  }
}

// Expose error types as static properties
ConditionallyExecute.TimeoutError = TimeoutError;
ConditionallyExecute.ConditionallyExecuteError = ConditionallyExecuteError;

module.exports = ConditionallyExecute;
