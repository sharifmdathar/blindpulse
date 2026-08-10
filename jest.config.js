/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.ts$": [
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
};
