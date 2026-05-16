# conditionally-execute

> Lets you abandon `if` keyword

[![Node.js CI](https://github.com/bopke/conditionally-execute/actions/workflows/nodejs.yml/badge.svg)](https://github.com/bopke/conditionally-execute/actions/workflows/nodejs.yml)
[![npm](https://img.shields.io/npm/v/conditionally-execute)](https://www.npmjs.com/package/conditionally-execute)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Install

```bash
npm install conditionally-execute
```

## Usage

```javascript
const ConditionallyExecute = require('conditionally-execute');
```

It's extremely easy to start using conditionally-execute, with its simple, straightforward and intelligible design.

Just take a look on that piece of code:

```javascript
function thatsTrue() { console.log('True!'); }
function thatsNotTrue() { console.log('False!'); }

await new ConditionallyExecute()
  .condition(1 === 1)
  .onTrue(thatsTrue)
  .onFalse(thatsNotTrue)
  .execute();
```

The above code will, obviously, print out `"True!"`.

Method calls can be in any order, as long as `.execute()` is last:

```javascript
await new ConditionallyExecute()
  .onFalse(thatsNotTrue)
  .condition(1 === 1)
  .onTrue(thatsTrue)
  .execute();
```

### Default condition

If `.condition()` is never called, the default is `true` — all `.onTrue()` handlers will execute:

```javascript
await new ConditionallyExecute()
  .onTrue(() => console.log('this always runs'))
  .execute();
```

### Async handlers

`.execute()` returns a `Promise` and awaits all registered handlers concurrently:

```javascript
await new ConditionallyExecute()
  .condition(user.isPremium)
  .onTrue(async () => { await grantPremiumAccess(); })
  .onFalse(async () => { await showUpgradePrompt(); })
  .execute();
```

### Multiple handlers

Multiple `.onTrue()` / `.onFalse()` calls are supported. All registered handlers
for the active branch run concurrently on `.execute()`:

```javascript
await new ConditionallyExecute()
  .condition(isDeploying)
  .onTrue(() => notifySlack())
  .onTrue(() => updateDashboard())
  .onTrue(() => incrementDeployCounter())
  .execute();
```

### Usage with existing code

old, ugly iffed code:

```javascript
if (condition) {
  console.log('yes');
} else {
  console.log('no');
}
```

new, beautiful conditionally-executed code:

```javascript
await new ConditionallyExecute()
  .condition(condition)
  .onTrue(() => console.log('yes'))
  .onFalse(() => console.log('no'))
  .execute();
```

## API

### `new ConditionallyExecute()`

Creates a new instance. Default condition is `true`.

### `.condition(value)` → `this`

Sets the condition. `value` is coerced to boolean via `Boolean()`. Last call wins if called multiple times.

### `.onTrue(fn)` → `this`

Registers `fn` to execute when condition is truthy. Throws `TypeError` if `fn` is not a function.

### `.onFalse(fn)` → `this`

Registers `fn` to execute when condition is falsy. Throws `TypeError` if `fn` is not a function.

### `.execute()` → `Promise<void>`

Executes all handlers for the active branch concurrently. Must be the last call in the chain.

## License

MIT © [Michał Kubik](https://github.com/bopke)
