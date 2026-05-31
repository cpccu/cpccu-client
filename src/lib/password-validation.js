export const PASSWORD_RULES = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (password) => password.length >= 8,
  },
  {
    id: "lowercase",
    label: "One lowercase letter",
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: "uppercase",
    label: "One uppercase letter",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: "number",
    label: "One number",
    test: (password) => /\d/.test(password),
  },
  {
    id: "special",
    label: "One special character",
    test: (password) => /[!@#$%^&*(),.?":{}|<>]/.test(password),
  },
];

export const validatePassword = (password = "") => {
  const checks = PASSWORD_RULES.map((rule) => ({
    ...rule,
    isValid: rule.test(password),
  }));
  const errors = checks
    .filter((check) => !check.isValid)
    .map((check) => check.label);

  return {
    checks,
    errors,
    isValid: errors.length === 0,
    strength: checks.filter((check) => check.isValid).length,
  };
};
