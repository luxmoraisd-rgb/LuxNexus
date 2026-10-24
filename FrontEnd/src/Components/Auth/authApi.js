import axios from 'axios';

/**
 * Backend API Base URL configuration.
 * Configured via .env (VITE_API_BASE_URL) or defaults to local backend server.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/auth';

/**
 * Axios instance configured for Authentication APIs.
 */
export const authClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Attach Authorization bearer token if available in sessionStorage
authClient.interceptors.request.use(
  (config) => {
    try {
      const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Ignore storage access errors
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Authentication API Service
 * All auth operations (signin, signup, forgot password, OTP verification, password reset, and Google auth)
 * communicate strictly with backend endpoints via Axios.
 */
export const authApi = {
  /**
   * User Sign In
   * POST /login/ or /signin
   * @param {{ email: string, password: string, rememberMe?: boolean }} credentials
   */
  signin: async (credentials) => {
    const payload = {
      username: credentials.email || credentials.username,
      email: credentials.email,
      password: credentials.password,
      rememberMe: credentials.rememberMe,
    };
    try {
      return await authClient.post('/login/', payload);
    } catch (err) {
      if (err.response?.status === 404 || !err.response) {
        try {
          return await authClient.post('/auth/signin', payload);
        } catch {
          return await authClient.post('/login', payload);
        }
      }
      throw err;
    }
  },

  /**
   * User Sign Up
   * POST /signup/ or /register
   * @param {{ fullName: string, name: string, email: string, password: string }} userData
   */
  signup: async (userData) => {
    const payload = {
      username: userData.username || (userData.fullName ? userData.fullName.replace(/\s+/g, '_').toLowerCase() : userData.email?.split('@')[0]),
      fullName: userData.fullName || userData.name,
      email: userData.email,
      password: userData.password,
      confirm_password: userData.confirmPassword || userData.confirm_password || userData.password,
    };
    try {
      return await authClient.post('/signup/', payload);
    } catch (err) {
      if (err.response?.status === 404 || !err.response) {
        try {
          return await authClient.post('/auth/signup', payload);
        } catch {
          return await authClient.post('/signup', payload);
        }
      }
      throw err;
    }
  },

  /**
   * Request Password Reset OTP
   * POST /send-otp/
   * @param {{ email: string }} data
   */
  forgotPassword: async (data) => {
    try {
      return await authClient.post('/send-otp/', data);
    } catch (err) {
      if (err.response?.status === 404 && !err.response?.data?.error) {
        return await authClient.post('/auth/send-otp', data);
      }
      throw err;
    }
  },

  /**
   * Verify Password Reset OTP
   * POST /verify-otp/
   * @param {{ email: string, otp: string }} data
   */
  verifyOtp: async (data) => {
    try {
      return await authClient.post('/verify-otp/', data);
    } catch (err) {
      if (err.response?.status === 404 && !err.response?.data?.error) {
        return await authClient.post('/auth/verify-otp', data);
      }
      throw err;
    }
  },

  /**
   * Reset / Update Password
   * POST /reset-password/
   * @param {{ email: string, otp: string, newPassword: string, password?: string, confirmPassword?: string }} data
   */
  resetPassword: async (data) => {
    const payload = {
      email: data.email,
      otp: data.otp,
      new_password: data.newPassword || data.password,
      confirm_password: data.confirmPassword || data.newPassword || data.password,
    };
    try {
      return await authClient.post('/reset-password/', payload);
    } catch (err) {
      if (err.response?.status === 404 && !err.response?.data?.error) {
        return await authClient.post('/auth/reset-password', payload);
      }
      throw err;
    }
  },

  /**
   * Google OAuth Authentication
   * POST /api/auth/google
   * @param {{ email: string, name?: string, provider?: string, token?: string }} data
   */
  googleAuth: async (data) => {
    return await authClient.post('/auth/google', data);
  },

  /**
   * Get Current Authenticated User Profile
   * GET /api/auth/me (with fallback to /api/auth/user)
   */
  getCurrentUser: async () => {
    try {
      return await authClient.get('/auth/me');
    } catch (err) {
      if (err.response?.status === 404) {
        return await authClient.get('/auth/user');
      }
      throw err;
    }
  },

  /**
   * Get Active User Sessions
   * GET /api/auth/sessions/
   */
  getSessions: async () => {
    try {
      return await authClient.get('/sessions/');
    } catch (err) {
      if (err.response?.status === 404) {
        return await authClient.get('/auth/sessions/');
      }
      throw err;
    }
  },

  /**
   * Terminate a Session
   * DELETE /api/auth/sessions/:id
   */
  deleteSession: async (sessionId) => {
    try {
      return await authClient.delete(`/sessions/${sessionId}/`);
    } catch {
      return await authClient.delete(`/sessions/${sessionId}`);
    }
  },

  /**
   * Sign out / Invalidate Session
   * POST /api/auth/logout/
   */
  logout: async () => {
    try {
      return await authClient.post('/logout/');
    } catch {
      try {
        return await authClient.post('/auth/logout/');
      } catch {
        // Allow logout to proceed even if backend is unreachable
        return { data: { success: true } };
      }
    }
  },
};

export default authApi;
