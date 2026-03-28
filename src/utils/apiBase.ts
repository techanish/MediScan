/**
 * Shared API base URL resolution and fallback networking helpers.
 */

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeApiBase(rawValue: string): string {
  const trimmed = stripTrailingSlash((rawValue || '').trim());
  if (!trimmed) return '';

  const parse = (value: string): string => {
    const parsed = new URL(value);
    const normalizedPath = stripTrailingSlash(parsed.pathname);
    return normalizedPath && normalizedPath !== '/'
      ? `${parsed.origin}${normalizedPath}`
      : parsed.origin;
  };

  try {
    return parse(trimmed);
  } catch {
    const withoutProtocol = trimmed.replace(/^https?:\/\//i, '');
    try {
      return parse(`https://${withoutProtocol}`);
    } catch {
      return '';
    }
  }
}

function isLocalHostUrl(value: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(value);
}

function withRailwayHostnameFallback(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (!parsed.hostname.endsWith('.up.railway.app')) {
      return null;
    }

    const hostParts = parsed.hostname.split('.');
    const appName = hostParts[0] || '';
    const compactAppName = appName.replace(/-/g, '');

    if (!compactAppName || compactAppName === appName) {
      return null;
    }

    const fallback = new URL(parsed.toString());
    fallback.hostname = [compactAppName, ...hostParts.slice(1)].join('.');

    return stripTrailingSlash(fallback.toString());
  } catch {
    return null;
  }
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

export function getApiBaseCandidates(rawApiBase: string | undefined): string[] {
  const configured = normalizeApiBase(rawApiBase || '');
  const runningOnLocalHost =
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname);

  const candidates: string[] = [];

  if (configured) {
    candidates.push(configured);

    const railwayFallback = withRailwayHostnameFallback(configured);
    if (railwayFallback) {
      candidates.push(railwayFallback);
    }
  }

  const sanitizedCandidates = dedupe(candidates).filter((candidate) => {
    if (runningOnLocalHost) return true;
    return !isLocalHostUrl(candidate);
  });

  if (!runningOnLocalHost) {
    sanitizedCandidates.push('');
  }

  const finalCandidates = dedupe(sanitizedCandidates);

  return finalCandidates.length > 0 ? finalCandidates : [''];
}

export function resolveApiUrl(endpoint: string, apiBase: string): string {
  if (!endpoint.startsWith('/')) {
    throw new Error(`API endpoint must start with '/': ${endpoint}`);
  }

  return apiBase ? `${apiBase}${endpoint}` : endpoint;
}

export async function fetchWithApiBaseFallback(
  endpoint: string,
  init: RequestInit,
  apiBaseCandidates: readonly string[]
): Promise<Response> {
  const candidates = apiBaseCandidates.length > 0 ? apiBaseCandidates : [''];
  let lastNetworkError: unknown = null;

  for (const apiBase of candidates) {
    const url = resolveApiUrl(endpoint, apiBase);

    try {
      return await fetch(url, init);
    } catch (error) {
      lastNetworkError = error;
    }
  }

  if (lastNetworkError instanceof Error) {
    throw lastNetworkError;
  }

  throw new Error(`Network error while calling ${endpoint}`);
}
