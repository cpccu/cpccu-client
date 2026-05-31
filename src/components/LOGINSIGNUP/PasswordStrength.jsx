import { validatePassword } from "@/lib/password-validation";

const strengthLabels = ["Very weak", "Weak", "Fair", "Good", "Strong"];
const strengthColors = [
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-lime-500",
  "bg-green-600",
];

export default function PasswordStrength({ password }) {
  if (!password) return null;

  const validation = validatePassword(password);
  const score = Math.max(validation.strength, 1);
  const label = strengthLabels[score - 1];
  const color = strengthColors[score - 1];

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3 text-sm">
      <div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full rounded-full transition-all ${color}`}
            style={{ width: `${score * 20}%` }}
          />
        </div>
        <p className="mt-1 font-semibold text-gray-700">Strength: {label}</p>
      </div>
      <ul className="grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
        {validation.checks.map((check) => (
          <li
            className={check.isValid ? "text-green-700" : "text-gray-500"}
            key={check.id}
          >
            {check.isValid ? "OK" : "-"} {check.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
