import axios from 'axios';

const API_URL = 'http://localhost:8080';

const api = axios.create({
    baseURL: API_URL,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const authService = {
    login: (credentials) => api.post('/api/auth/login', credentials),
    register: (userData) => api.post('/api/auth/register', userData),
};

export const roomService = {
    getRooms: () => api.get('/api/rooms'),
    getRoom: (id) => api.get(`/api/rooms/${id}`),
    createRoom: (roomData) => api.post('/api/rooms', roomData.name, {
        headers: { 'Content-Type': 'text/plain' }
    }),
};

export const projectFileService = {
    getFiles: (roomId) => api.get(`/api/files/${roomId}`),
    saveFile: (roomId, filePath, content) => api.post(`/api/files/${roomId}?filePath=${encodeURIComponent(filePath)}`, content, { headers: { 'Content-Type': 'text/plain' } }),
    deleteFile: (roomId, filePath) => api.delete(`/api/files/${roomId}?filePath=${encodeURIComponent(filePath)}`)
};

export default api;
