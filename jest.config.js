/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.(ts|tsx|js|mjs)$": [
      "ts-jest",
      {
        tsconfig: {
          target: "ES2020",
          module: "commonjs",
          moduleResolution: "node",
          lib: ["ES2020", "dom"],
          esModuleInterop: true,
          allowJs: true,
          strict: true,
          skipLibCheck: true,
        },
      },
    ],
  },
  // @noble/hashes ships ESM-only ("type": "module"); let jest transform its
  // files with ts-jest (module: commonjs) instead of leaving them as-is.
  transformIgnorePatterns: ["node_modules/(?!(.pnpm/)?@noble)"],
};
