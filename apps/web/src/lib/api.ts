const API_BASE_URL = '/api';

export class ApiError extends Error {
  statusCode: number;
  data?: any;

  constructor(message: string, statusCode: number, data?: any) {
    super(message);
    this.statusCode = statusCode;
    this.data = data;
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('bot_sales_token');

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    localStorage.removeItem('bot_sales_token');
    localStorage.removeItem('bot_sales_user');
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }

  if (headers['Accept'] === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || options.method === 'GET' && endpoint.includes('export') || endpoint.includes('template')) {
    if (!response.ok) {
      throw new ApiError('Gagal mengunduh file', response.status);
    }
    return response.blob() as any;
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = result.message || (result.errors ? result.errors.map((e: any) => e.message).join(', ') : 'Terjadi kesalahan');
    throw new ApiError(errorMsg, response.status, result);
  }

  return result;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
