'use strict';

module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2022,
  },
  rules: {
    'no-unused-vars': 'error',
    'no-console': 'warn',
    'eqeqeq': ['error', 'always'],
    'strict': ['error', 'global'],
    'prefer-const': 'error',
    'no-var': 'error',
  },
};
