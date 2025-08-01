export interface User {
  id: number;
  employee_id: string;
  email: string;
  first_name: string;
  last_name: string;
  department: string;
  role: 'admin' | 'manager' | 'staff';
  phone?: string;
  is_active: boolean;
  created_at: string;
}

export interface MeetingRoom {
  id: number;
  name: string;
  location: string;
  capacity: number;
  description?: string;
  features: string[];
  is_active: boolean;
  created_at: string;
}

export interface Booking {
  id: number;
  room_id: number;
  user_id: number;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  participants: string[];
  status: 'confirmed' | 'cancelled' | 'pending';
  is_recurring: boolean;
  recurrence_pattern?: RecurrencePattern;
  calendar_event_id?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  room_name?: string;
  room_location?: string;
  booked_by?: string;
  user_department?: string;
  booker_email?: string;
}

export interface RecurrencePattern {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number;
  end_date?: string;
  days_of_week?: number[]; // For weekly recurrence (0 = Sunday, 1 = Monday, etc.)
  day_of_month?: number; // For monthly recurrence
}

export interface BookingFormData {
  room_id: number;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  participants: string[];
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern;
}

export interface RoomAvailability {
  id: number;
  name: string;
  location: string;
  capacity: number;
  bookings: {
    id: number;
    title: string;
    start_time: string;
    end_time: string;
    booked_by: string;
  }[];
}

export interface DashboardStats {
  summary: {
    total_users: number;
    total_rooms: number;
    total_bookings: number;
    today_bookings: number;
  };
  booking_trends: {
    date: string;
    bookings: number;
  }[];
  room_utilization: {
    name: string;
    capacity: number;
    total_bookings: number;
    avg_duration: string;
  }[];
  department_usage: {
    department: string;
    bookings: number;
  }[];
  top_users: {
    name: string;
    department: string;
    bookings: number;
  }[];
}

export interface SystemSettings {
  [key: string]: {
    value: string;
    description: string;
  };
}

export interface ApiResponse<T> {
  message?: string;
  error?: string;
  errors?: { msg: string; param: string }[];
  data?: T;
  // For paginated responses
  page?: number;
  limit?: number;
  total?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  user: User;
  token: string;
}

export interface RegisterRequest {
  employee_id: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  department: string;
  phone?: string;
}

// Context types
export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  loading: boolean;
  isAuthenticated: boolean;
}

export interface NotificationContextType {
  showNotification: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  hideNotification: () => void;
}

// Form validation types
export interface ValidationErrors {
  [key: string]: string;
}

// Filter and search types
export interface BookingFilters {
  room_id?: number;
  date?: string;
  user_id?: number;
  status?: string;
  department?: string;
}

export interface UserFilters {
  department?: string;
  role?: string;
  status?: 'active' | 'inactive';
  search?: string;
}