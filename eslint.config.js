import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import react from 'eslint-plugin-react';

export default [
  js.configs.recommended,
  {
    plugins: { react },
    rules: {
      'react/react-in-jsx-scope': 'off', // if using React 17+
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        React: true,
      },
    },
  },
  prettier,
];
