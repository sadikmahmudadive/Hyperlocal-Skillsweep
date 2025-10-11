import { createContext, useContext, useReducer, useEffect } from 'react';
import { useRouter } from 'next/router';

const AuthContext = createContext();

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, loading: true, error: null };
    case 'LOGIN_SUCCESS':
      return { 
        ...state, 
        loading: false, 
        user: action.payload, 
        isAuthenticated: true,
        error: null 
      };
    case 'LOGIN_FAILURE':
      return { ...state, loading: false, error: action.payload };
    case 'LOGOUT':
      return { 
        ...state, 
        user: null, 
        isAuthenticated: false, 
        loading: false,
        error: null 
      };
    case 'UPDATE_USER':
      return { ...state, user: { ...state.user, ...action.payload } };
    case 'UPDATE_USER_PROFILE_SUCCESS':
      return { 
        ...state, 
        user: action.payload,
        loading: false 
      };
    case 'SET_FAVORITES':
      return state.user
        ? { ...state, user: { ...state.user, favorites: action.payload } }
        : state;
    case 'SET_SAVED_SEARCHES':
      return state.user
        ? { ...state, user: { ...state.user, savedSearches: action.payload } }
        : state;
    case 'UPDATE_LOADING':
      return { ...state, loading: action.payload };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'SET_REDIRECT_PATH':
      return { ...state, redirectPath: action.payload };
    default:
      return state;
  }
};

const initialState = {
  user: null,
  isAuthenticated: false,
  loading: true,
  error: null,
  redirectPath: '/dashboard'
};

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const router = useRouter();

  const normalizeUser = (user) => {
    if (!user) return user;
    return {
      ...user,
      favorites: Array.isArray(user.favorites) ? user.favorites : [],
      savedSearches: Array.isArray(user.savedSearches) ? user.savedSearches : []
    };
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Check if user is authenticated on app load
  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        dispatch({ type: 'LOGOUT' });
        return;
      }

      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const user = await response.json();
        dispatch({ type: 'LOGIN_SUCCESS', payload: normalizeUser(user) });
      } else {
        localStorage.removeItem('token');
        dispatch({ type: 'LOGOUT' });
      }
    } catch (error) {
      localStorage.removeItem('token');
      dispatch({ type: 'LOGOUT' });
    }
  };

  // Login function
  const login = async (email, password) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      
      if (response.ok) {
        localStorage.setItem('token', data.token);
        dispatch({ type: 'LOGIN_SUCCESS', payload: normalizeUser(data.user) });
        router.push(state.redirectPath || '/dashboard');
        dispatch({ type: 'SET_REDIRECT_PATH', payload: '/dashboard' }); // Reset redirect path
      } else {
        dispatch({ type: 'LOGIN_FAILURE', payload: data.message });
      }
    } catch (error) {
      dispatch({ type: 'LOGIN_FAILURE', payload: 'Login failed. Please try again.' });
    }
  };

  // Register function
  const register = async (userData) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      const data = await response.json();
      
      if (response.ok) {
        localStorage.setItem('token', data.token);
        dispatch({ type: 'LOGIN_SUCCESS', payload: normalizeUser(data.user) });
        router.push('/dashboard/profile?welcome=true');
      } else {
        dispatch({ type: 'LOGIN_FAILURE', payload: data.message });
      }
    } catch (error) {
      dispatch({ type: 'LOGIN_FAILURE', payload: 'Registration failed. Please try again.' });
    }
  };

  // Logout function
  const logout = async () => {
    // Call logout API to invalidate token on server (optional)
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
    } catch (error) {
      console.log('Logout API call failed:', error);
    }
    
    localStorage.removeItem('token');
    dispatch({ type: 'LOGOUT' });
    router.push('/');
  };

  // Update user profile
  const updateUserProfile = async (userData) => {
    dispatch({ type: 'UPDATE_LOADING', payload: true });
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(userData)
      });

      const data = await response.json();
      
      if (response.ok) {
        dispatch({ type: 'UPDATE_USER_PROFILE_SUCCESS', payload: data.user });
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.message };
      }
    } catch (error) {
      console.error('Profile update error:', error);
      return { success: false, error: 'Profile update failed. Please try again.' };
    } finally {
      dispatch({ type: 'UPDATE_LOADING', payload: false });
    }
  };

  // Update user skills
  const updateUserSkills = async (skillsData) => {
    dispatch({ type: 'UPDATE_LOADING', payload: true });
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/skills', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(skillsData)
      });

      const data = await response.json();
      
      if (response.ok) {
        dispatch({ type: 'UPDATE_USER_PROFILE_SUCCESS', payload: data.user });
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.message };
      }
    } catch (error) {
      console.error('Skills update error:', error);
      return { success: false, error: 'Skills update failed. Please try again.' };
    } finally {
      dispatch({ type: 'UPDATE_LOADING', payload: false });
    }
  };

  // Add a new skill
  const addSkill = async (type, skill) => {
    dispatch({ type: 'UPDATE_LOADING', payload: true });
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/skills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type, skill })
      });

      const data = await response.json();
      
      if (response.ok) {
        dispatch({ type: 'UPDATE_USER_PROFILE_SUCCESS', payload: data.user });
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.message };
      }
    } catch (error) {
      console.error('Add skill error:', error);
      return { success: false, error: 'Failed to add skill. Please try again.' };
    } finally {
      dispatch({ type: 'UPDATE_LOADING', payload: false });
    }
  };

  // Remove a skill
  const removeSkill = async (type, skillId) => {
    dispatch({ type: 'UPDATE_LOADING', payload: true });
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/skills', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type, skillId })
      });

      const data = await response.json();
      
      if (response.ok) {
        dispatch({ type: 'UPDATE_USER_PROFILE_SUCCESS', payload: data.user });
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.message };
      }
    } catch (error) {
      console.error('Remove skill error:', error);
      return { success: false, error: 'Failed to remove skill. Please try again.' };
    } finally {
      dispatch({ type: 'UPDATE_LOADING', payload: false });
    }
  };

  // Refresh user data
  const refreshUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const user = await response.json();
        dispatch({ type: 'UPDATE_USER', payload: normalizeUser(user) });
        return user;
      }
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  };

  // Check if user has specific skill
  const hasSkill = (skillName, type = 'offered') => {
    if (!state.user) return false;
    const skills = type === 'offered' ? state.user.skillsOffered : state.user.skillsNeeded;
    return skills?.some(skill => 
      skill.name.toLowerCase() === skillName.toLowerCase()
    );
  };

  // Get user's skill categories
  const getUserSkillCategories = (type = 'offered') => {
    if (!state.user) return [];
    const skills = type === 'offered' ? state.user.skillsOffered : state.user.skillsNeeded;
    return [...new Set(skills?.map(skill => skill.category) || [])];
  };

  // Set redirect path for after login
  const setRedirectPath = (path) => {
    dispatch({ type: 'SET_REDIRECT_PATH', payload: path });
  };

  // Require auth hook (for protected routes)
  const requireAuth = (callback) => {
    return (...args) => {
      if (!state.isAuthenticated) {
        setRedirectPath(router.asPath);
        router.push('/auth/login');
        return;
      }
      return callback(...args);
    };
  };

  // Favorites helpers
  const refreshFavorites = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await fetch('/api/users/favorites', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) return;
      const data = await response.json();
      dispatch({ type: 'SET_FAVORITES', payload: data.ids || [] });
      return data;
    } catch (error) {
      console.error('Failed to refresh favorites:', error);
    }
  };

  const addFavorite = async (providerId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return { success: false, error: 'Not authenticated' };
      const response = await fetch('/api/users/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ providerId })
      });
      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_FAVORITES', payload: data.ids || [] });
        return { success: true, favorite: data.favorite };
      }
      return { success: false, error: data?.message || 'Failed to favorite user' };
    } catch (error) {
      console.error('Add favorite error:', error);
      return { success: false, error: 'Failed to favorite user' };
    }
  };

  const removeFavorite = async (providerId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return { success: false, error: 'Not authenticated' };
      const response = await fetch('/api/users/favorites', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ providerId })
      });
      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_FAVORITES', payload: data.ids || [] });
        return { success: true };
      }
      return { success: false, error: data?.message || 'Failed to remove favorite' };
    } catch (error) {
      console.error('Remove favorite error:', error);
      return { success: false, error: 'Failed to remove favorite' };
    }
  };

  // Saved search helpers
  const refreshSavedSearches = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await fetch('/api/users/saved-searches', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) return;
      const data = await response.json();
      dispatch({ type: 'SET_SAVED_SEARCHES', payload: data.savedSearches || [] });
      return data;
    } catch (error) {
      console.error('Failed to load saved searches:', error);
    }
  };

  const createSavedSearch = async (name, filters) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return { success: false, error: 'Not authenticated' };
      const response = await fetch('/api/users/saved-searches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, filters })
      });
      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_SAVED_SEARCHES', payload: data.savedSearches || [] });
        return { success: true };
      }
      return { success: false, error: data?.message || 'Failed to save search' };
    } catch (error) {
      console.error('Create saved search error:', error);
      return { success: false, error: 'Failed to save search' };
    }
  };

  const updateSavedSearch = async (id, payload) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return { success: false, error: 'Not authenticated' };
      const response = await fetch('/api/users/saved-searches', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id, ...payload })
      });
      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_SAVED_SEARCHES', payload: data.savedSearches || [] });
        return { success: true };
      }
      return { success: false, error: data?.message || 'Failed to update saved search' };
    } catch (error) {
      console.error('Update saved search error:', error);
      return { success: false, error: 'Failed to update saved search' };
    }
  };

  const deleteSavedSearch = async (id) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return { success: false, error: 'Not authenticated' };
      const response = await fetch('/api/users/saved-searches', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id })
      });
      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_SAVED_SEARCHES', payload: data.savedSearches || [] });
        return { success: true };
      }
      return { success: false, error: data?.message || 'Failed to delete saved search' };
    } catch (error) {
      console.error('Delete saved search error:', error);
      return { success: false, error: 'Failed to delete saved search' };
    }
  };
  const value = {
    // State
    ...state,
    
    // Authentication functions
    login,
    register,
    logout,
    
    // User data functions
  updateUser: (userData) => dispatch({ type: 'UPDATE_USER', payload: normalizeUser(userData) }),
    updateUserProfile,
    updateUserSkills,
    addSkill,
    removeSkill,
    refreshUserData,
    
    // Utility functions
    hasSkill,
    getUserSkillCategories,
    setRedirectPath,
  requireAuth,
  refreshFavorites,
  addFavorite,
  removeFavorite,
  refreshSavedSearches,
  createSavedSearch,
  updateSavedSearch,
  deleteSavedSearch,
    
    // Error handling
    clearError: () => dispatch({ type: 'CLEAR_ERROR' }),
    setLoading: (loading) => dispatch({ type: 'UPDATE_LOADING', payload: loading })
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Higher Order Component for protecting routes
export const withAuth = (Component) => {
  return function ProtectedComponent(props) {
    const { isAuthenticated, loading, requireAuth } = useAuth();
    
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      );
    }
    
    if (!isAuthenticated) {
      requireAuth(() => {})();
      return null;
    }
    
    return <Component {...props} />;
  };
};

// Hook for protecting pages
export const useRequireAuth = (redirectPath = '/auth/login') => {
  const { isAuthenticated, loading, setRedirectPath } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      setRedirectPath(router.asPath);
      router.push(redirectPath);
    }
  }, [isAuthenticated, loading, router, redirectPath, setRedirectPath]);

  return { isAuthenticated, loading };
};