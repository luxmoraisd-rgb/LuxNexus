import axios from 'axios';

/**
 * Profile API Configuration
 * 
 * The API client attaches the current bearer token from sessionStorage.
 * 3. The API client will automatically attach JWT/Bearer token from sessionStorage.
 */
export const PROFILE_API_CONFIG = {
  // Base URL defaults to VITE_API_BASE_URL or local server
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',

  // API Endpoints
  ENDPOINTS: {
    GET_PROFILE: '/auth/profile/',
    UPDATE_PROFILE: '/auth/profile/',
    UPLOAD_AVATAR: '/auth/profile/avatar/',
    CHANGE_PASSWORD: '/profile/change-password/',
  },

  // Allow cached profile reads when the profile endpoint is unavailable.
  USE_FALLBACK_ON_ERROR: true,
};

// Create Axios client configured for Profile service
export const profileClient = axios.create({
  baseURL: PROFILE_API_CONFIG.BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Automatically attach Bearer token from sessionStorage
profileClient.interceptors.request.use(
  (config) => {
    try {
      const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Ignore storage access error
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Retrieve cached profile from sessionStorage or localStorage
 */
const normalizeProfile = (profile) => {
  const location = typeof profile.location === 'string' ? profile.location : '';
  const photo =
    typeof profile.photo === 'string'
      ? profile.photo
      : typeof profile.avatar === 'string'
        ? profile.avatar
        : '';

  return {
    ...profile,
    location:
      location.trim().toLowerCase() === 'san francisco, california' ? '' : location,
    photo: photo.includes('Yamaha_R15_v4_bike.jpg') ? '' : photo,
  };
};

export const getLocalFallbackProfile = () => {
  try {
    const cachedProfile = localStorage.getItem('nexus_user_profile');
    if (cachedProfile) {
      return normalizeProfile(JSON.parse(cachedProfile));
    }

    const sessionUser = sessionStorage.getItem('user');
    if (sessionUser) {
      const user = JSON.parse(sessionUser);
      return normalizeProfile({
        name: user.name || user.fullName || user.username || 'User',
        email: user.email || '',
        username: user.username || '',
        jobTitle: user.jobTitle || 'Full Stack Developer',
        role: user.role || 'Member',
        mobile: user.mobile || user.phone || '',
        location: user.location || '',
        birthday: user.birthday || '',
        photo: user.photo || user.avatar || '',
        teams: user.teams || ['Engineering'],
        bio: user.bio || '',
      });
    }
  } catch (err) {
    console.warn('[Profile API] Could not read local storage fallback:', err);
  }

  return {
    name: 'User',
    email: '',
    username: '',
    jobTitle: 'Full Stack Developer',
    role: 'Member',
    mobile: '',
    location: '',
    photo: '',
    bio: '',
  };
};

/**
 * Persist updated profile to localStorage and sync with sessionStorage user
 */
export const saveLocalFallbackProfile = (updatedProfile) => {
  try {
    const existing = getLocalFallbackProfile();
    const merged = { ...existing, ...updatedProfile };
    localStorage.setItem('nexus_user_profile', JSON.stringify(merged));

    // Sync with sessionStorage 'user' object so Navbar, header, and other views stay in sync
    const sessionUserRaw = sessionStorage.getItem('user');
    const sessionUser = sessionUserRaw ? JSON.parse(sessionUserRaw) : {};
    const updatedSessionUser = {
      ...sessionUser,
      name: merged.name,
      fullName: merged.name,
      email: merged.email || sessionUser.email,
      photo: merged.photo,
      avatar: merged.photo,
      mobile: merged.mobile,
      jobTitle: merged.jobTitle,
      location: merged.location,
    };
    sessionStorage.setItem('user', JSON.stringify(updatedSessionUser));
    return merged;
  } catch (err) {
    console.warn('[Profile API] Could not save local storage fallback:', err);
    return updatedProfile;
  }
};

/**
 * Profile API Service
 * All frontend interactions pass through this clean API service.
 */
export const profileApi = {
  /**
   * Fetch current user's profile
   * GET /api/profile/
   */
  getProfile: async () => {
    try {
      const res = await profileClient.get(PROFILE_API_CONFIG.ENDPOINTS.GET_PROFILE);
      const data = res.data?.data || res.data;
      saveLocalFallbackProfile(data);
      return {
        success: true,
        data,
        source: 'api',
      };
    } catch (err) {
      if (PROFILE_API_CONFIG.USE_FALLBACK_ON_ERROR) {
        console.info('[Profile API] Backend endpoint not yet available. Using local state fallback.');
        const fallbackData = getLocalFallbackProfile();
        return {
          success: true,
          data: fallbackData,
          source: 'local_fallback',
          error: err.message,
        };
      }
      throw err;
    }
  },

  /**
   * Update profile details
   * PATCH /api/auth/profile/
   * @param {Object} updatedFields (name, jobTitle, mobile, location, birthday, bio, etc.)
   */
  updateProfile: async (updatedFields) => {
    const res = await profileClient.patch(
      PROFILE_API_CONFIG.ENDPOINTS.UPDATE_PROFILE,
      updatedFields
    );
    const data = res.data?.data || res.data || updatedFields;
    saveLocalFallbackProfile(data);
    return {
      success: true,
      data,
      source: 'api',
    };
  },

  /**
   * Upload profile avatar picture
   * POST /api/auth/profile/avatar/
   * @param {File|Blob|string} avatarFile - Image File or data URL
   * @param {string} [dataUrlPreview] - Optional data URL preview
   */
  uploadAvatar: async (avatarFile, dataUrlPreview) => {
    const formData = new FormData();
    if (avatarFile instanceof File || avatarFile instanceof Blob) {
      formData.append('avatar', avatarFile);
    } else {
      formData.append('photo', avatarFile);
    }

    const res = await profileClient.post(
      PROFILE_API_CONFIG.ENDPOINTS.UPLOAD_AVATAR,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      }
    );
    const photoUrl = res.data?.photo || res.data?.avatarUrl || res.data?.avatar || dataUrlPreview;
    saveLocalFallbackProfile({ photo: photoUrl });
    return {
      success: true,
      photo: photoUrl,
      source: 'api',
    };
  },

  /**
   * Change account password
   * Connects to backend and persists updated password hash in MongoDB Compass.
   * POST /api/profile/change-password/ (with fallbacks to /auth/profile/change-password/)
   */
  changePassword: async ({ currentPassword, newPassword, confirmPassword, otp, email, username }) => {
    let storedUser = null;
    try {
      const sessionUserRaw = typeof window !== 'undefined' ? sessionStorage.getItem('user') : null;
      storedUser = sessionUserRaw ? JSON.parse(sessionUserRaw) : null;
    } catch {
      storedUser = null;
    }

    const payload = {
      old_password: currentPassword,
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
      otp: otp || undefined,
      email: email || storedUser?.email || undefined,
      username: username || storedUser?.username || undefined,
    };

    let res;
    try {
      res = await profileClient.post(
        PROFILE_API_CONFIG.ENDPOINTS.CHANGE_PASSWORD,
        payload
      );
    } catch (primaryErr) {
      // If 404, try alternative path
      if (primaryErr.response?.status === 404) {
        try {
          res = await profileClient.post('/auth/profile/change-password/', payload);
        } catch (secondaryErr) {
          if (secondaryErr.response?.status === 404) {
            res = await profileClient.post('/change-password/', payload);
          } else {
            throw secondaryErr;
          }
        }
      } else {
        throw primaryErr;
      }
    }

    if (res?.data?.token) {
      try {
        sessionStorage.setItem('token', res.data.token);
        if (typeof localStorage !== 'undefined' && localStorage.getItem('token')) {
          localStorage.setItem('token', res.data.token);
        }
      } catch {}
    }

    return {
      success: true,
      message: res?.data?.message || 'Password changed successfully in MongoDB.',
      data: res?.data,
    };
  },
};

export default profileApi;
