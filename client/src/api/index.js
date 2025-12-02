import axios from 'axios';
import decode from 'jwt-decode';

// Create an axios instance
const API = axios.create({ baseURL: process.env.REACT_APP_API_URL });

// Middleware to add the token to every request
API.interceptors.request.use((req) => {
  if (localStorage.getItem('profile')) {
    const token = JSON.parse(localStorage.getItem('profile')).token;

    // Check if token is expired BEFORE sending request
    const decodedToken = decode(token);
    if (decodedToken.exp * 1000 < new Date().getTime()) {
      localStorage.clear();
      window.location.href = '/auth';
      return Promise.reject('Token Expired');
    }

    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

// Handle 401/403 responses from server (Double safety)
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      localStorage.clear();
      window.location.href = '/auth';
    }
    return Promise.reject(error);
  },
);

export const fetchPosts = () => API.get('/posts');
export const createPost = (newPost) => API.post('/posts', newPost);
export const likePost = (id) => API.patch(`/posts/${id}/likePost`);
export const updatePost = (id, updatedPost) => API.patch(`/posts/${id}`, updatedPost);
export const deletePost = (id) => API.delete(`/posts/${id}`);

export const signIn = (formData) => API.post('/user/signin', formData);
export const signUp = (formData) => API.post('/user/signup', formData);
export const fetchTickers = () => API.get('/external/tickers');
export const fetchNews = () => API.get('/external/news');
