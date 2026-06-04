import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — logout on token expiry
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default api;

/**
 * Stream SSE response from /api/chat/message
 * Calls onChunk(text) for each streamed token
 * Calls onDone() when complete
 */
export async function streamMessage({ companionId, message, mood }, onChunk, onDone, onError) {
  const token = useAuthStore.getState().token;

  try {
    const response = await fetch(`${API_BASE}/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ companionId, message, mood }),
    });

    if (!response.ok) {
      const err = await response.json();
      onError(err.error || 'Failed to get response');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const json = JSON.parse(line.slice(6));
            if (json.model) console.log(`🤖 [AI Model Shift] Currently using model: ${json.model}`);
            if (json.chunk) onChunk(json.chunk);
            if (json.done) onDone();
            if (json.error) onError(json.error);
          } catch {}
        }
      }
    }
  } catch (err) {
    onError(err.message || 'Connection failed');
  }
}

/**
 * Stream greeting SSE from /api/chat/greet/:companionId
 * Called automatically when a companion has no message history.
 */
export async function streamGreet({ companionId }, onChunk, onDone, onError) {
  const token = useAuthStore.getState().token;

  try {
    const response = await fetch(`${API_BASE}/chat/greet/${companionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    // If skipped (already has messages), just call done silently
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      onDone();
      return;
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      onError(err.error || 'Failed to get greeting');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const json = JSON.parse(line.slice(6));
            if (json.model) console.log(`🤖 [AI Model Shift] Currently using model: ${json.model}`);
            if (json.chunk) onChunk(json.chunk);
            if (json.done) onDone();
            if (json.error) onError(json.error);
          } catch {}
        }
      }
    }
  } catch (err) {
    onError(err.message || 'Connection failed');
  }
}
