module.exports = {
  root: true,
  extends: ["next/core-web-vitals", "next/react"],
  ignorePatterns: [".next", "node_modules", ".eslintrc.cjs"],
  rules: {
    "react/jsx-no-target-blank": "error",
  },
};
