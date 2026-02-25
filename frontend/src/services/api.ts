import axios, {
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import type {
  ApiResponse,
  AuthData,
  Video,
  VideoListData,
  VideoListParams,
  User,
  UserListParams,
  UploadProgressHandler,
} from "../type";

const API_BASE: string = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});


api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});


api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);


export const authAPI = {
  register: (data: {
    name: string;
    email: string;
    password: string;
    organisation?: string;
  }): Promise<AxiosResponse<ApiResponse<AuthData>>> =>
    api.post("/auth/register", data),

  login: (data: {
    email: string;
    password: string;
  }): Promise<AxiosResponse<ApiResponse<AuthData>>> =>
    api.post("/auth/login", data),

  getMe: (): Promise<AxiosResponse<ApiResponse<{ user: User }>>> =>
    api.get("/auth/me"),
};


export const videoAPI = {
  list: (
    params?: VideoListParams,
  ): Promise<AxiosResponse<ApiResponse<VideoListData>>> =>
    api.get("/videos", { params }),

  get: (id: string): Promise<AxiosResponse<ApiResponse<{ video: Video }>>> =>
    api.get(`/videos/${id}`),

  upload: (
    formData: FormData,
    onUploadProgress?: UploadProgressHandler,
  ): Promise<AxiosResponse<ApiResponse<{ video: Video }>>> =>
    api.post("/videos/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
    }),

  update: (
    id: string,
    data: Partial<
      Pick<Video, "title" | "description" | "category" | "visibility">
    > & { tags?: string },
  ): Promise<AxiosResponse<ApiResponse<{ video: Video }>>> =>
    api.put(`/videos/${id}`, data),

  delete: (id: string): Promise<AxiosResponse<ApiResponse<null>>> =>
    api.delete(`/videos/${id}`),

  reprocess: (id: string): Promise<AxiosResponse<ApiResponse<null>>> =>
    api.post(`/videos/${id}/reprocess`),

  streamUrl: (id: string): string => {
    const token = localStorage.getItem("token");
    return `${API_BASE}/videos/${id}/stream?token=${token}`;
  },
};


export const userAPI = {
  list: (
    params?: UserListParams,
  ): Promise<AxiosResponse<ApiResponse<{ users: User[] }>>> =>
    api.get("/users", { params }),

  updateRole: (
    id: string,
    role: string,
  ): Promise<AxiosResponse<ApiResponse<{ user: User }>>> =>
    api.put(`/users/${id}/role`, { role }),

  toggleStatus: (
    id: string,
  ): Promise<AxiosResponse<ApiResponse<null> & { message: string }>> =>
    api.patch(`/users/${id}/status`),
};

export default api;
