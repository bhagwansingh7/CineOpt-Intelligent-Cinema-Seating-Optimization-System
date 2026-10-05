import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true, // the session lives in an HTTP-only cookie
  timeout: 30000,
});

export function errorMessage(err) {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.code === 'ERR_NETWORK') return 'Cannot reach the CineOpt server. Check that the backend is running.';
  if (err?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  return err?.message || 'Something went wrong';
}

const unwrap = (promise) => promise.then((res) => res.data.data);

export const authApi = {
  register: (body) => unwrap(api.post('/auth/register', body)),
  login: (body) => unwrap(api.post('/auth/login', body)),
  logout: () => unwrap(api.post('/auth/logout')),
  me: () => unwrap(api.get('/auth/me')),
};

export const theatreApi = {
  list: () => unwrap(api.get('/theatres')),
  get: (id) => unwrap(api.get(`/theatres/${id}`)),
  seats: (id) => unwrap(api.get(`/theatres/${id}/seats`)),
};

export const bookingApi = {
  optimize: (body) => unwrap(api.post('/bookings/optimize', body)),
  create: (body) => unwrap(api.post('/bookings', body)),
  list: () => unwrap(api.get('/bookings')),
  get: (id) => unwrap(api.get(`/bookings/${id}`)),
};

export const adminApi = {
  users: () => unwrap(api.get('/admin/users')),
  setRole: (id, role) => unwrap(api.patch(`/admin/users/${id}/role`, { role })),
  bookings: () => unwrap(api.get('/admin/bookings')),
  theatres: () => unwrap(api.get('/admin/theatres')),
  seats: (id) => unwrap(api.get(`/admin/theatres/${id}/seats`)),
};

export default api;
