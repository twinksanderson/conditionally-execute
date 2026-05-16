# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- TypeScript source (`src/index.ts`) with `strict` mode enabled
- `ConditionallyExecuteOptions` interface with `initialCondition` and `collectErrors` options
- `collectErrors` mode: collects all handler errors into an `AggregateError` instead of short-circuiting
- Full JSDoc documentation on all public members
- `.prettierrc` code style configuration
- `.editorconfig` for consistent editor settings
- GitHub issue templates (bug report, feature request)
- GitHub PR template
- `dependabot.yml` for automated dependency updates
- TypeScript type checking CI job (`npm run typecheck`)
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`
- `bench.js` — performance benchmark vs native `if`

### Changed
- **Breaking**: `execute()` is now `async` and returns `Promise<void>`
  (previously synchronous — any code that did not `await` execute() was already
  silently ignoring async handlers)
- Condition logic: `this.True` (public, boolean-typed `true` literal) replaced
  with `this._condition` (private boolean). Last `.condition()` call wins.
- `onTrue()` and `onFalse()` now throw `TypeError` immediately for non-function arguments
- CI updated: `actions/checkout@v2` → `v4`, `setup-node@v1` → `v4` (with npm cache)
- CI: removed no-op `npm run build --if-present`, added lint and typecheck steps
- README: fixed typo in install command (`conditionaly-execute` → `conditionally-execute`)
- README: added full API reference, async examples, default condition documentation
- Node.js support floor raised from 16 (EOL) to 18 (LTS)

### Fixed
- Multi-condition bug: calling `.condition(false).condition(true)` previously
  ignored the second call; it now correctly uses the last-provided value
- Promise-returning handlers were silently dropped; all handlers now properly awaited

## [1.0.0] — Initial release

- `ConditionallyExecute` class with `.condition()`, `.onTrue()`, `.onFalse()`, `.execute()`
- Fluent builder API with arbitrary method ordering
- Basic Mocha test suite
- GitHub Actions CI (Node 16–24)
