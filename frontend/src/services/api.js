import axios from 'axios';

const api = axios.create({
    baseURL: '',
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
    deleteRoom: (id) => api.delete(`/api/rooms/${id}`),
    renameRoom: (id, newName) => api.patch(`/api/rooms/${id}/rename`, newName, {
        headers: { 'Content-Type': 'text/plain' }
    }),
    joinRoom: (roomId) => api.post(`/api/rooms/${roomId}/join`),
    checkAccess: (roomId) => api.get(`/api/rooms/${roomId}/access`),
};

export const projectFileService = {
    getFiles:   (roomId) => api.get(`/api/files/${roomId}`),
    saveFile:   (roomId, filePath, content) => api.post(
        `/api/files/${roomId}?filePath=${encodeURIComponent(filePath)}`,
        content,
        { headers: { 'Content-Type': 'text/plain' } }
    ),
    deleteFile: (roomId, filePath) => api.delete(`/api/files/${roomId}?filePath=${encodeURIComponent(filePath)}`),

    createNode: (roomId, { name, fileType, parentId }) =>
        api.post(`/api/files/${roomId}/nodes`, { name, fileType, parentId: parentId ?? null }),

    renameNode: (id, newName) =>
        api.patch(`/api/files/nodes/${id}/rename`, { newName }),

    moveNode: (id, targetParentId) =>
        api.patch(`/api/files/nodes/${id}/move`, { targetParentId: targetParentId ?? null }),

    deleteNode: (id) =>
        api.delete(`/api/files/nodes/${id}`),

    executeCode: (language, code, fileName, stdin, timeoutSeconds) =>
        api.post('/api/execute', { language, code, fileName, stdin, timeoutSeconds }),

    getSupportedLanguages: () =>
        api.get('/api/execute/languages'),
};

export default api;
