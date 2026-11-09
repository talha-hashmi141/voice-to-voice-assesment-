import base from '@voice-agent/config/eslint/base';

export default [
  ...base,
  {
    rules: {
      // NestJS relies on constructor-injected classes being referenced as values
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  {
    files: ['scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
];
