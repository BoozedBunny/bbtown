export type StrapiListResponse<T> = {
  data: T[];
  meta?: unknown;
};

export type StrapiSingleResponse<T> = {
  data: T | null;
  meta?: unknown;
  error?: unknown;
};

const DEFAULT_STRAPI_BASE_URL = "http://127.0.0.1:1339";

function getStrapiBaseUrl(): string {
  return process.env.STRAPI_URL ?? DEFAULT_STRAPI_BASE_URL;
}

function getAuthHeaders(): HeadersInit {
  const token = process.env.STRAPI_API_TOKEN;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function strapiFetchList<T>(path: string, options?: RequestInit): Promise<StrapiListResponse<T>> {
  const baseUrl = getStrapiBaseUrl();

  const fetchOptions: RequestInit = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(options?.headers || {}),
    },
  };

  if (!fetchOptions.cache && !fetchOptions.next) {
    fetchOptions.next = { revalidate: 30 };
  }

  const response = await fetch(`${baseUrl}${path}`, fetchOptions);

  if (!response.ok) {
    throw new Error(`Strapi list request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as StrapiListResponse<T>;
}

export async function strapiFetchSingle<T>(path: string): Promise<StrapiSingleResponse<T>> {
  const baseUrl = getStrapiBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    next: { revalidate: 30 },
  });

  if (response.status === 404) {
    return { data: null };
  }

  if (!response.ok) {
    throw new Error(`Strapi single request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as StrapiSingleResponse<T>;
}
