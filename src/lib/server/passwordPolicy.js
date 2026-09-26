import 'server-only';

/**
 * Port of `cpccu-server/src/utils/passwordPolicy.js`.
 *
 * The policy is a DATA structure: each rule is `{ label, test }`, and the
 * validator filters the array and maps the survivors to their labels. Two
 * consequences worth knowing before editing it:
 *  - `label` is user-facing text (it is joined into the error message), so the
 *    wording is part of the API contract the client displays verbatim;
 *  - the rules are evaluated with `.filter()`, so ALL failures are reported at
 *    once. Do not convert this to a loop that returns on the first failure —
 *    the form shows every unmet requirement, which is the point.
 */
const passwordRequirements = [
  {
    // MINIMUM LENGTH 8. This is the only thing standing between an attacker and
    // a fast offline dictionary/rule attack on a leaked hash: bcrypt's cost
    // factor buys time only for guesses the attacker can afford to make, and
    // length is what raises the number of guesses. It is a MINIMUM, not an
    // exact length.
    label: 'at least 8 characters',
    test: (password) => password.length >= 8,
  },
  {
    // REQUIRES a lowercase character. Blocks the single-CASE-CLASS and
    // all-numeric / all-symbol password shapes (e.g. `12345678`, `!!!!!!!!`)
    // that are first in every cracking dictionary, by forcing at least two
    // character classes.
    label: 'one lowercase letter',
    test: (password) => /[a-z]/.test(password),
  },
  {
    // REQUIRES an uppercase character. Same rationale as the lowercase rule;
    // it also multiplies the effective keyspace of a leaked hash.
    label: 'one uppercase letter',
    test: (password) => /[A-Z]/.test(password),
  },
  {
    // REQUIRES a digit. This is the cheapest of the five requirements to satisfy
    // by accident (people append `1`), so on its own it is close to a no-op —
    // it is kept because it is part of the published policy and because the
    // 12-factor/segment rules that the Next client enforces in its own password
    // meter depend on the combination.
    label: 'one number',
    test: (password) => /\d/.test(password),
  },
  {
    // REQUIRES one of a fixed set of punctuation characters. The character
    // CLASS is a literal allow-list, not `\W` or a negated class: an allow-list
    // is used so the policy cannot be satisfied by characters that are awkward
    // to type on the keyboards and mobile keyboards the club's students
    // actually use, or that are easy to mistype into a different field.
    // Practical effect: it blocks purely alphabetic + numeric passwords.
    label: 'one special character',
    test: (password) => /[!@#$%^&*(),.?":{}|<>]/.test(password),
  },
];

/**
 * Returns `{ errors, isValid }`. `errors` is the list of unmet `label`s, empty
 * when the password is acceptable.
 *
 * The `password = ''` default is load-bearing: an omitted or undefined password
 * must still be REJECTED, and a missing default would throw a TypeError on
 * `.length` instead, turning a validation failure into a 500.
 *
 * This is a server-side check on its own account — a client-side meter is a
 * convenience, and anything that reaches this function from a request body has
 * to be re-validated here, because the client is not trusted.
 */
const validatePasswordStrength = (password = '') => {
  const errors = passwordRequirements
    .filter((requirement) => !requirement.test(password))
    .map((requirement) => requirement.label);

  return {
    errors,
    isValid: errors.length === 0,
  };
};

/**
 * Joins the unmet requirements into the single human-readable sentence the
 * response carries. The join is `', '` with no "and" before the last item, so
 * the result reads as a comma list — a known cosmetic quirk, preserved because
 * this string is echoed to the client and changing it changes visible copy.
 */
const passwordPolicyMessage = (errors) =>
  `Password must include ${errors.join(', ')}.`;

export { passwordPolicyMessage, validatePasswordStrength };
