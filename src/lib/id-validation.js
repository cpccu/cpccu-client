const DIGITS_ONLY_RE = /^\d+$/;

export function isValidStudentId(value) {
  if (typeof value !== 'string') value = String(value ?? '');
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.length < 6 || trimmed.length > 20) return false;
  if (!DIGITS_ONLY_RE.test(trimmed)) return false;
  if (/\d+e\d+/i.test(trimmed)) return false;
  return true;
}

export function normalizeStudentId(value) {
  if (value == null) return '';
  return String(value).trim();
}

export function isIdentifierField(fieldName) {
  const lower = String(fieldName).toLowerCase();
  return [
    'studentid',
    'recipientstudentid',
    'recipientid',
    'uniid',
    'universityid',
    'certificateid',
    'certificatenumber',
    'phone',
    'membershipid',
    'memberid',
    'userid',
    'batch',
    'batchno',
    'batch_no',
    'id',
    'skucode',
    'serialnumber',
    'trackingnumber',
    'registrationnumber',
    'employeenumber',
    'employeecode',
    'staffid',
    'facultyid',
    'rollnumber',
    'registrationno',
    'refno',
    'referenceno',
    'refno',
    'applid',
    'applicationid',
  ].some((idKey) => lower === idKey || lower.endsWith(idKey) || lower.includes(idKey));
}

export function forceString(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return String(value);
}

export function detectScientificNotation(value) {
  if (typeof value !== 'string') value = String(value ?? '');
  return /\d+\.?\d*e[+-]?\d+/i.test(value.trim());
}

export function sanitizeId(value) {
  const raw = forceString(value);
  if (detectScientificNotation(raw)) return null;
  return raw;
}
