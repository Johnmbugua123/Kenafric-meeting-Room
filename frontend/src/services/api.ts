import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
  User, 
  LoginRequest, 
  LoginResponse, 
  RegisterRequest,
  Booking,
  BookingFormData,
  MeetingRoom,
  RoomAvailability,
  DashboardStats,
  SystemSettings,
  BookingFilters,
  UserFilters
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response: AxiosResponse<LoginResponse> = await this.api.post('/auth/login', credentials);
    return response.data;
  }

  async register(userData: RegisterRequest): Promise<LoginResponse> {
    const response: AxiosResponse<LoginResponse> = await this.api.post('/auth/register', userData);
    return response.data;
  }

  async verifyToken(): Promise<{ valid: boolean; user: User }> {
    const response = await this.api.get('/auth/verify');
    return response.data;
  }

  async getProfile(): Promise<{ user: User }> {
    const response = await this.api.get('/auth/profile');
    return response.data;
  }

  async updateProfile(userData: Partial<User>): Promise<{ message: string; user: User }> {
    const response = await this.api.put('/auth/profile', userData);
    return response.data;
  }

  async changePassword(data: { current_password: string; new_password: string }): Promise<{ message: string }> {
    const response = await this.api.put('/auth/change-password', data);
    return response.data;
  }

  // Room endpoints
  async getRooms(): Promise<{ rooms: MeetingRoom[] }> {
    const response = await this.api.get('/rooms');
    return response.data;
  }

  async getRoom(id: number): Promise<{ room: MeetingRoom }> {
    const response = await this.api.get(`/rooms/${id}`);
    return response.data;
  }

  async getRoomAvailability(id: number, date: string): Promise<{ room: MeetingRoom; date: string; bookings: any[] }> {
    const response = await this.api.get(`/rooms/${id}/availability?date=${date}`);
    return response.data;
  }

  async getAvailability(date: string, roomIds?: number[]): Promise<{ date: string; rooms: RoomAvailability[] }> {
    let url = `/bookings/availability?date=${date}`;
    if (roomIds && roomIds.length > 0) {
      url += `&room_ids=${roomIds.join(',')}`;
    }
    const response = await this.api.get(url);
    return response.data;
  }

  async createRoom(roomData: Omit<MeetingRoom, 'id' | 'created_at' | 'is_active'>): Promise<{ message: string; room: MeetingRoom }> {
    const response = await this.api.post('/rooms', roomData);
    return response.data;
  }

  async updateRoom(id: number, roomData: Partial<MeetingRoom>): Promise<{ message: string; room: MeetingRoom }> {
    const response = await this.api.put(`/rooms/${id}`, roomData);
    return response.data;
  }

  async deleteRoom(id: number): Promise<{ message: string }> {
    const response = await this.api.delete(`/rooms/${id}`);
    return response.data;
  }

  // Booking endpoints
  async getBookings(filters?: BookingFilters): Promise<{ bookings: Booking[] }> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString());
        }
      });
    }
    const response = await this.api.get(`/bookings?${params}`);
    return response.data;
  }

  async getBooking(id: number): Promise<{ booking: Booking }> {
    const response = await this.api.get(`/bookings/${id}`);
    return response.data;
  }

  async createBooking(bookingData: BookingFormData): Promise<{ message: string; booking: Booking }> {
    const response = await this.api.post('/bookings', bookingData);
    return response.data;
  }

  async updateBooking(id: number, bookingData: Partial<BookingFormData>): Promise<{ message: string; booking: Booking }> {
    const response = await this.api.put(`/bookings/${id}`, bookingData);
    return response.data;
  }

  async cancelBooking(id: number): Promise<{ message: string }> {
    const response = await this.api.patch(`/bookings/${id}/cancel`);
    return response.data;
  }

  async deleteBooking(id: number): Promise<{ message: string }> {
    const response = await this.api.delete(`/bookings/${id}`);
    return response.data;
  }

  async getUpcomingBookings(limit = 10): Promise<{ bookings: Booking[] }> {
    const response = await this.api.get(`/bookings/my/upcoming?limit=${limit}`);
    return response.data;
  }

  // User management endpoints
  async getUsers(filters?: UserFilters): Promise<{ users: User[] }> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString());
        }
      });
    }
    const response = await this.api.get(`/users?${params}`);
    return response.data;
  }

  async getUser(id: number): Promise<{ user: User }> {
    const response = await this.api.get(`/users/${id}`);
    return response.data;
  }

  async createUser(userData: RegisterRequest & { role: string }): Promise<{ message: string; user: User }> {
    const response = await this.api.post('/users', userData);
    return response.data;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<{ message: string; user: User }> {
    const response = await this.api.put(`/users/${id}`, userData);
    return response.data;
  }

  async resetUserPassword(id: number, newPassword: string): Promise<{ message: string }> {
    const response = await this.api.post(`/users/${id}/reset-password`, { new_password: newPassword });
    return response.data;
  }

  async updateUserStatus(id: number, isActive: boolean): Promise<{ message: string }> {
    const response = await this.api.patch(`/users/${id}/status`, { is_active: isActive });
    return response.data;
  }

  async getUserStats(id: number, startDate?: string, endDate?: string): Promise<any> {
    let url = `/users/${id}/stats`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params}`;
    
    const response = await this.api.get(url);
    return response.data;
  }

  async getDepartments(): Promise<{ departments: string[] }> {
    const response = await this.api.get('/users/lookup/departments');
    return response.data;
  }

  // Admin endpoints
  async getAdminDashboard(): Promise<DashboardStats> {
    const response = await this.api.get('/admin/dashboard');
    return response.data;
  }

  async getUsageReport(filters?: { start_date?: string; end_date?: string; room_id?: number; department?: string }): Promise<any> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString());
        }
      });
    }
    const response = await this.api.get(`/admin/reports/usage?${params}`);
    return response.data;
  }

  async getEfficiencyReport(startDate?: string, endDate?: string): Promise<any> {
    let url = '/admin/reports/efficiency';
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params}`;
    
    const response = await this.api.get(url);
    return response.data;
  }

  async getSystemSettings(): Promise<{ settings: SystemSettings }> {
    const response = await this.api.get('/admin/settings');
    return response.data;
  }

  async updateSystemSettings(settings: { [key: string]: string }): Promise<{ message: string }> {
    const response = await this.api.put('/admin/settings', { settings });
    return response.data;
  }

  async getSystemHealth(): Promise<any> {
    const response = await this.api.get('/admin/health');
    return response.data;
  }

  async exportData(type: 'bookings' | 'users' | 'rooms', startDate?: string, endDate?: string): Promise<any> {
    let url = `/admin/export/${type}`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params}`;
    
    const response = await this.api.get(url);
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string; environment: string }> {
    const response = await this.api.get('/health');
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;