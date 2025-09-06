export default {
  preset: 'ts-jest/presets/default-esm', // or other ESM preset
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'test/tsconfig.json',
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.\\.?\\/.+)\\\.js$': '$1',
  },
  extensionsToTreatAsEsm: ['.ts'],
}; 