/** @typedef {(name: string) => string | undefined} EnvironmentReader */

/**
 * @param {string | undefined} serializedKeys
 * @returns {string | undefined}
 */
function readDefaultKey(serializedKeys) {
  if (!serializedKeys) return undefined;

  try {
    const keys = JSON.parse(serializedKeys);
    const defaultKey = keys.default;
    return typeof defaultKey === 'string' && defaultKey.trim() ? defaultKey.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** @param {string | undefined} value */
const readNonBlank = (value) => value?.trim() || undefined;

/**
 * @param {EnvironmentReader} readEnvironment
 * @returns {string | undefined}
 */
export function resolveSupabaseSecretKey(readEnvironment) {
  return readDefaultKey(readEnvironment('SUPABASE_SECRET_KEYS'))
    || readNonBlank(readEnvironment('SUPABASE_SECRET_KEY'))
    || readNonBlank(readEnvironment('SUPABASE_SERVICE_ROLE_KEY'));
}

/**
 * @param {EnvironmentReader} readEnvironment
 * @returns {string | undefined}
 */
export function resolveSupabasePublishableKey(readEnvironment) {
  return readDefaultKey(readEnvironment('SUPABASE_PUBLISHABLE_KEYS'))
    || readNonBlank(readEnvironment('SUPABASE_PUBLISHABLE_KEY'))
    || readNonBlank(readEnvironment('SUPABASE_ANON_KEY'));
}
