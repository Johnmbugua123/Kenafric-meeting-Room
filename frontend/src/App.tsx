import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Bookings from './pages/Bookings';
import BookingForm from './pages/BookingForm';
import Rooms from './pages/Rooms';
import Profile from './pages/Profile';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import RoomManagement from './pages/admin/RoomManagement';
import Reports from './pages/admin/Reports';

// Create theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      dark: '#115293',
      light: '#42a5f5',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <AuthProvider>
          <NotificationProvider>
            <Router>
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                
                {/* Protected Routes */}
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Routes>
                          <Route path="/" element={<Navigate to="/dashboard" replace />} />
                          <Route path="/dashboard" element={<Dashboard />} />
                          <Route path="/bookings" element={<Bookings />} />
                          <Route path="/bookings/new" element={<BookingForm />} />
                          <Route path="/bookings/edit/:id" element={<BookingForm />} />
                          <Route path="/rooms" element={<Rooms />} />
                          <Route path="/profile" element={<Profile />} />
                          
                          {/* Admin Routes */}
                          <Route 
                            path="/admin" 
                            element={
                              <ProtectedRoute requiredRole="admin">
                                <AdminDashboard />
                              </ProtectedRoute>
                            } 
                          />
                          <Route 
                            path="/admin/users" 
                            element={
                              <ProtectedRoute requiredRole="admin">
                                <UserManagement />
                              </ProtectedRoute>
                            } 
                          />
                          <Route 
                            path="/admin/rooms" 
                            element={
                              <ProtectedRoute requiredRole="admin">
                                <RoomManagement />
                              </ProtectedRoute>
                            } 
                          />
                          <Route 
                            path="/admin/reports" 
                            element={
                              <ProtectedRoute requiredRole="admin">
                                <Reports />
                              </ProtectedRoute>
                            } 
                          />
                        </Routes>
                      </Layout>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Router>
          </NotificationProvider>
        </AuthProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App;
