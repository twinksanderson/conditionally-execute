'use strict';

/**
 * A synchronous or asynchronous handler function.
 * The return value is discarded; use async handlers for side effects.
 */
export type Handler = () => void | Promise<void>;

/**
 * Options for configuring a {@link ConditionallyExecute} instance.
 * @since 2.0.0
 */
export interface ConditionallyExecuteOptions {
  /**
   * Initial condition value. Defaults to `true`.
   * Equivalent to calling `.condition(initialCondition)` immediately after construction.
   */
  initialCondition?: boolean;

  /**
   * If `true`, errors thrown by individual handlers are collected and rethrown
   * as an `AggregateError` after all handlers have been attempted, rather than
   * short-circuiting on the first failure.
   *
   * @default false
   */
  collectErrors?: boolean;
}

/**
 * ConditionallyExecute — enterprise-grade if-statement replacement.
 *
 * Provides a fluent, type-safe builder API for conditional execution of
 * callbacks. Supports multiple handlers per branch, fully async execution,
 * input validation, and configurable error collection strategy.
 *
 * @example Basic usage
 * ```typescript
 * await new ConditionallyExecute()
 *   .condition(user.isAdmin)
 *   .onTrue(() => grantAccess())
 *   .onFalse(() => denyAccess())
 *   .execute();
 * ```
 *
 * @example Async handlers
 * ```typescript
 * await new ConditionallyExecute()
 *   .condition(await checkDatabase())
 *   .onTrue(async () => {
 *     await sendWelcomeEmail();
 *     await updateAuditLog();
 *   })
 *   .execute();
 * ```
 *
 * @example Default condition (no `.condition()` call — defaults to `true`)
 * ```typescript
 * await new ConditionallyExecute()
 *   .onTrue(() => console.log('always runs'))
 *   .execute();
 * ```
 *
 * @example Options
 * ```typescript
 * const ce = new ConditionallyExecute({ collectErrors: true });
 * await ce
 *   .condition(true)
 *   .onTrue(async () => { throw new Error('handler 1 failed'); })
 *   .onTrue(async () => { throw new Error('handler 2 failed'); })
 *   .execute(); // throws AggregateError with both errors
 * ```
 *
 * @since 1.0.0
 */
export class ConditionallyExecute {
  /** @internal */
  private _condition: boolean;

  /** @internal */
  private _onTrue: Handler[];

  /** @internal */
  private _onFalse: Handler[];

  /** @internal */
  private _collectErrors: boolean;

  /**
   * Creates a new ConditionallyExecute instance.
   *
   * @param options - Optional configuration. See {@link ConditionallyExecuteOptions}.
   */
  constructor(options: ConditionallyExecuteOptions = {}) {
    this._condition = options.initialCondition ?? true;
    this._onTrue = [];
    this._onFalse = [];
    this._collectErrors = options.collectErrors ?? false;
  }

  /**
   * Sets the condition that determines which branch executes.
   *
   * The value is coerced to boolean via `Boolean()`. Calling this method
   * multiple times overwrites the previous value — the **last call wins**.
   *
   * If this method is never called, the condition defaults to `true`.
   *
   * @param condition - Any value; coerced to `boolean`.
   * @returns `this` for chaining.
   *
   * @example
   * ```typescript
   * new ConditionallyExecute()
   *   .condition(user.role === 'admin')
   *   .onTrue(() => showAdminPanel())
   *   .execute();
   * ```
   */
  condition(condition: unknown): this {
    this._condition = Boolean(condition);
    return this;
  }

  /**
   * Registers a handler to execute when the condition is **truthy**.
   *
   * Multiple handlers are supported. When `.execute()` is called, all
   * registered `onTrue` handlers run concurrently via `Promise.all`.
   *
   * @param func - A sync or async function to invoke. Must be a function.
   * @returns `this` for chaining.
   * @throws {TypeError} If `func` is not a function.
   *
   * @example
   * ```typescript
   * new ConditionallyExecute()
   *   .condition(isAuthenticated)
   *   .onTrue(() => redirectToDashboard())
   *   .onTrue(() => recordLoginEvent())
   *   .execute();
   * ```
   */
  onTrue(func: Handler): this {
    if (typeof func !== 'function') {
      throw new TypeError(
        `onTrue() expects a function, received ${typeof func}: ${String(func)}`
      );
    }
    this._onTrue.push(func);
    return this;
  }

  /**
   * Registers a handler to execute when the condition is **falsy**.
   *
   * Multiple handlers are supported. When `.execute()` is called, all
   * registered `onFalse` handlers run concurrently via `Promise.all`.
   *
   * @param func - A sync or async function to invoke. Must be a function.
   * @returns `this` for chaining.
   * @throws {TypeError} If `func` is not a function.
   *
   * @example
   * ```typescript
   * new ConditionallyExecute()
   *   .condition(user.hasSubscription)
   *   .onFalse(() => showPaywall())
   *   .onFalse(() => trackConversionOpportunity())
   *   .execute();
   * ```
   */
  onFalse(func: Handler): this {
    if (typeof func !== 'function') {
      throw new TypeError(
        `onFalse() expects a function, received ${typeof func}: ${String(func)}`
      );
    }
    this._onFalse.push(func);
    return this;
  }

  /**
   * Executes all registered handlers for the active branch.
   *
   * Handlers run **concurrently** via `Promise.all`. If `collectErrors` is
   * `false` (default), the first rejection short-circuits. If `collectErrors`
   * is `true`, all handlers are awaited and any errors are collected into an
   * `AggregateError`.
   *
   * **Must be the last call in the chain.**
   *
   * @returns A `Promise` that resolves when all active-branch handlers complete.
   * @throws The first handler error (default), or an `AggregateError` if
   *         `collectErrors` was enabled in the constructor options.
   *
   * @example
   * ```typescript
   * await new ConditionallyExecute()
   *   .condition(shouldSendEmail)
   *   .onTrue(async () => await mailer.send(message))
   *   .execute();
   * ```
   */
  async execute(): Promise<void> {
    const handlers = this._condition ? this._onTrue : this._onFalse;

    if (!this._collectErrors) {
      await Promise.all(handlers.map((fn) => fn()));
      return;
    }

    const results = await Promise.allSettled(handlers.map((fn) => fn()));
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => r.reason);

    if (errors.length > 0) {
      throw new AggregateError(errors, `${errors.length} handler(s) failed`);
    }
  }
}

export default ConditionallyExecute;
