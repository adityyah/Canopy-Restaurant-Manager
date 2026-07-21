// frontend/src/api/client.ts
// =============================================================================
// Axios API Client — Canopy Restaurant Manager
// =============================================================================
// This is the SINGLE Axios instance used across the entire frontend.
// All API calls must go through this client so that:
//   1. The JWT Authorization header is always attached (request interceptor).
//   2. API errors are translated to user-friendly messages (response interceptor).
//   3. The base URL is configured in one place and easy to change.
//
// Per RULES.md § E-5: "The React frontend must translate every error code into
// a short, friendly message shown in the UI."
//
// Per RULES.md § D-3: "The frontend may hide or show UI elements based on role,
// but this is only a cosmetic convenience — the backend is the real gatekeeper."
// =============================================================================

import axios, { AxiosError, type AxiosResponse } from 'axios'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// In development, Vite's proxy (vite.config.ts) forwards /api/* to :8000.
// In production, VITE_API_BASE_URL is set to the deployed backend URL.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

// ---------------------------------------------------------------------------
// Error Message Map (RULES.md § E-5)
// ---------------------------------------------------------------------------

const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED:             'Please log in to continue.',
  FORBIDDEN:                "You don't have permission to do that.",
  NOT_FOUND:                'The requested resource was not found.',
  VALIDATION_ERROR:         'Please check your input and try again.',
  OUT_OF_STOCK:             'Sorry, that item is no longer available.',
  INSUFFICIENT_POINTS:      "You don't have enough points for that reward.",
  RATE_LIMIT_EXCEEDED:      "You're going too fast! Please wait a moment.",
  INVALID_STATE_TRANSITION: 'This order can no longer be changed.',
  INTERNAL_ERROR:           'Something went wrong on our end. Please try again.',
}

// ---------------------------------------------------------------------------
// Axios Instance
// ---------------------------------------------------------------------------

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // 15-second timeout — prevents requests from hanging indefinitely
  timeout: 15_000,
})

// ---------------------------------------------------------------------------
// Request Interceptor — Attach JWT Token
// ---------------------------------------------------------------------------
// Reads the JWT from localStorage (stored by the auth flow after login)
// and attaches it as a Bearer token to every outgoing request.
//
// The backend's `get_current_user()` FastAPI dependency reads this header
// and verifies it against Supabase's JWKS endpoint.

apiClient.interceptors.request.use(
  (config) => {
    // The key 'canopy_jwt' is the contract between AuthContext and this client.
    const token = localStorage.getItem('canopy_jwt')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// ---------------------------------------------------------------------------
// Response Interceptor — Translate Errors (RULES.md § E-5)
// ---------------------------------------------------------------------------
// Intercepts every failed response and enriches the error object with:
//   - `friendlyMessage`: a user-facing string from ERROR_MESSAGES above
//   - `errorCode`: the raw code from the backend (e.g. 'UNAUTHORIZED')
//   - `statusCode`: the HTTP status number (401, 403, etc.)
//
// Components can then display `error.friendlyMessage` without worrying
// about raw JSON or error codes leaking into the UI.

export interface CanopyApiError extends AxiosError {
  friendlyMessage: string
  errorCode: string
  statusCode: number
}

apiClient.interceptors.response.use(
  // Pass successful responses straight through
  (response: AxiosResponse) => response,

  (error: AxiosError<{ error: boolean; code: string; message: string }>) => {
    const statusCode = error.response?.status ?? 0
    const errorCode  = error.response?.data?.code ?? 'INTERNAL_ERROR'

    // Look up the friendly message. Fall back to the raw backend message,
    // then to a generic fallback. Never expose the raw error code to the user.
    const friendlyMessage =
      ERROR_MESSAGES[errorCode] ??
      error.response?.data?.message ??
      ERROR_MESSAGES['INTERNAL_ERROR']

    // Attach extra properties to the error object
    const enrichedError = error as CanopyApiError
    enrichedError.friendlyMessage = friendlyMessage
    enrichedError.errorCode = errorCode
    enrichedError.statusCode = statusCode

    // Automatically redirect to login if the session has expired
    if (statusCode === 401) {
      localStorage.removeItem('canopy_jwt')
      // Don't navigate here directly — let the AuthContext handle it
      // by dispatching a custom event that AuthContext listens for.
      window.dispatchEvent(new Event('canopy:session-expired'))
    }

    return Promise.reject(enrichedError)
  },
)

// ---------------------------------------------------------------------------
// Typed Convenience Wrappers
// ---------------------------------------------------------------------------
// These replace raw axios.get/post calls so we always get proper typing.

export const api = {
  get: <T>(url: string, params?: object) =>
    apiClient.get<T>(url, { params }).then((r) => r.data),

  post: <T>(url: string, body?: unknown) =>
    apiClient.post<T>(url, body).then((r) => r.data),

  put: <T>(url: string, body?: unknown) =>
    apiClient.put<T>(url, body).then((r) => r.data),

  patch: <T>(url: string, body?: unknown) =>
    apiClient.patch<T>(url, body).then((r) => r.data),

  delete: <T>(url: string) =>
    apiClient.delete<T>(url).then((r) => r.data),
}
