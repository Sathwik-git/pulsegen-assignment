import type { AxiosProgressEvent } from "axios";

export type UserRole = "admin" | "editor" | "viewer";

export interface User {
  _id: string;
  id?: string;
  name: string;
  email: string;
  role: UserRole;
  organisation?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";
export type SensitivityClassification = "safe" | "flagged" | "unprocessed";
export type Visibility = "private" | "organisation" | "public";

export interface SensitivityDetails {
  adult: number;
  language: number;
}

export interface Video {
  _id: string;
  title: string;
  description?: string;
  originalName: string;
  size: number;
  tags?: string[];
  category?: string;
  visibility: Visibility;
  processingStatus: ProcessingStatus;
  processingProgress: number;
  processingError?: string;
  sensitivityClassification: SensitivityClassification;
  sensitivityScore?: number;
  sensitivityDetails?: SensitivityDetails;
  isStreamReady: boolean;
  thumbnailPath?: string;
  uploadedBy?: Pick<User, "_id" | "name">;
  createdAt: string;
  updatedAt: string;
  _message?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface PaginationInfo {
  page: number;
  pages: number;
  total: number;
  limit: number;
}

export interface AuthData {
  user: User;
  token: string;
}

export interface VideoListData {
  videos: Video[];
  pagination: PaginationInfo;
}

export interface VideoListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sensitivity?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface UserListParams {
  limit?: number;
  page?: number;
}

export interface VideoProgressEvent {
  videoId: string;
  progress: number;
  status: ProcessingStatus;
  message?: string;
}

export interface VideoCompleteEvent {
  videoId: string;
  sensitivityClassification: SensitivityClassification;
  sensitivityScore?: number;
  sensitivityDetails?: SensitivityDetails;
}

export interface VideoErrorEvent {
  videoId: string;
  error: string;
}

export type UploadProgressHandler = (progressEvent: AxiosProgressEvent) => void;
