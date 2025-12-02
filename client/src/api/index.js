import axios from 'axios';
import jwtDecode from 'jwt-decode';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
});

const isTokenExpired = (token) => {
  try {
    const decoded = jwtDecode(token);
    if (!decoded.exp) return false;
    const now = Date.now() / 1000;
    return decoded.exp < now;
  } catch {
    return true;
  }
};

const logout = () => {
  localStorage.removeItem('profile');
  // Adjust this route to match your auth page
  window.location.href = '/auth';
};

API.interceptors.request.use((req) => {
  const profileStr = localStorage.getItem('profile');
  if (profileStr) {
    const profile = JSON.parse(profileStr);
    if (profile?.token) {
      if (isTokenExpired(profile.token)) {
        logout();
      } else {
        req.headers.Authorization = `Bearer ${profile.token}`;
      }
    }
  }

  return req;
});

// Auto-logout on 401/403
API.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response && [401, 403].includes(error.response.status)) {
      logout();
    }
    return Promise.reject(error);
  },
);

export const fetchPosts = () => API.get('/posts');
export const createPost = (newPost) => API.post('/posts', newPost);
export const updatePost = (id, updatedPost) =>
  API.patch(`/posts/${id}`, updatedPost);
export const deletePost = (id) => API.delete(`/posts/${id}`);
export const likePost = (id) => API.patch(`/posts/${id}/likePost`);

export const signIn = (formData) => API.post('/user/signin', formData);
export const signUp = (formData) => API.post('/user/signup', formData);
export const fetchTickers = () => API.get('/external/tickers');
export const fetchNews = () => API.get('/external/news');

export default API;
