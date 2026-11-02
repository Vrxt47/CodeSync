export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponseData {
  user: User;
  accessToken: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  code?: string;
  errors?: Array<{ field: string; message: string }>;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}
