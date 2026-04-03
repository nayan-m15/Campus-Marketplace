/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom", // for React
  moduleFileExtensions: ["js", "jsx", "ts", "tsx"],
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest"
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"]
};