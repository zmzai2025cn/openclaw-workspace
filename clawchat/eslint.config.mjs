export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        require: "readonly",
        module: "readonly",
        exports: "readonly"
      }
    },
    rules: {
      "no-unused-vars": "error",
      "no-undef": "error",
      "no-console": "off",
      "no-empty": "error",
      "no-extra-semi": "error",
      "no-unreachable": "error",
      "no-unsafe-finally": "error",
      "no-unsafe-negation": "error",
      "no-unused-expressions": "error",
      "no-unused-labels": "error",
      "no-use-before-define": "error",
      "eqeqeq": "error",
      "curly": "error",
      "no-var": "error",
      "prefer-const": "error"
    }
  }
];