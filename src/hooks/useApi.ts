import { Album, Track, ApiUser } from '@/types/music';

const TOKEN_KEY = 'melodiver_token';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearToken();
    throw new Error('Unauthorized');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data as T;
}

// --- Auth API ---

export const authApi = {
  async register(username: string, email: string, password: string): Promise<{ token: string; user: ApiUser }> {
    const result = await apiFetch<{ token: string; user: ApiUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
    setToken(result.token);
    return result;
  },

  async login(email: string, password: string): Promise<{ token: string; user: ApiUser }> {
    const result = await apiFetch<{ token: string; user: ApiUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(result.token);
    return result;
  },

  async me(): Promise<ApiUser | null> {
    if (!getToken()) return null;
    try {
      const result = await apiFetch<{ user: ApiUser }>('/api/auth/me');
      return result.user;
    } catch {
      return null;
    }
  },

  logout() {
    clearToken();
  },

  async updateProfile(data: { username?: string; email?: string }): Promise<ApiUser> {
    const result = await apiFetch<{ user: ApiUser }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return result.user;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiFetch('/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  async deleteAccount(password: string): Promise<void> {
    await apiFetch('/api/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });
    clearToken();
  },

  async getStats(): Promise<{ albumCount: number; trackCount: number; storageBytes: number; createdAt: string | null }> {
    const result = await apiFetch<{ stats: { albumCount: number; trackCount: number; storageBytes: number; createdAt: string | null } }>('/api/auth/stats');
    return result.stats;
  },
};

// --- Albums API ---

export const albumsApi = {
  async list(): Promise<Album[]> {
    const result = await apiFetch<{ albums: Album[] }>('/api/albums');
    return result.albums;
  },

  async get(id: string): Promise<Album> {
    const result = await apiFetch<{ album: Album }>(`/api/albums/${id}`);
    return result.album;
  },

  async create(name: string): Promise<Album> {
    const result = await apiFetch<{ album: Album }>('/api/albums', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    return result.album;
  },

  async update(id: string, data: { name: string }): Promise<void> {
    await apiFetch('/api/albums/' + id, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<void> {
    await apiFetch('/api/albums/' + id, {
      method: 'DELETE',
    });
  },

  async uploadCover(id: string, file: File): Promise<string> {
    const formData = new FormData();
    formData.append('cover', file);
    const result = await apiFetch<{ coverPath: string }>(`/api/albums/${id}/cover`, {
      method: 'POST',
      body: formData,
    });
    return result.coverPath;
  },
};

// --- Tracks API ---

export const tracksApi = {
  async importFromUrl(albumId: string, url: string): Promise<Track> {
    const result = await apiFetch<{ track: Track }>('/api/tracks/import', {
      method: 'POST',
      body: JSON.stringify({ albumId, url }),
    });
    return result.track;
  },

  async create(albumId: string, file: File, metadata?: { title?: string; artist?: string }): Promise<Track> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('albumId', albumId);
    if (metadata?.title) formData.append('title', metadata.title);
    if (metadata?.artist) formData.append('artist', metadata.artist);

    const result = await apiFetch<{ track: Track }>('/api/tracks', {
      method: 'POST',
      body: formData,
    });
    return result.track;
  },

  async update(id: string, data: { title?: string; artist?: string }): Promise<void> {
    await apiFetch('/api/tracks/' + id, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<void> {
    await apiFetch('/api/tracks/' + id, {
      method: 'DELETE',
    });
  },
};
