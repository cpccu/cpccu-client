/**
 * Safely extract a certificate array from any API response.
 *
 * Handles all three access patterns used across the project:
 *   - Hook state:   result.data = { success, data: [...] }
 *   - Promise:      promise.data = { success, data: [...] }
 *   - Direct fetch: json.data        = { success, data: [...] }
 *
 * Returns a guaranteed array (never undefined, never throws).
 */
export function getCertificatesFromResponse(response) {
  if (!response?.data) return [];
  const data = response.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}
