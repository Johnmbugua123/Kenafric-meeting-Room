import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Container,
  Paper,
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Grid,
} from '@mui/material';
import { Business } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [submitLoading, setSubmitLoading] = useState(false);
  const [apiError, setApiError] = useState<string>('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !loading) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, loading, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear field error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');

    if (!validateForm()) {
      return;
    }

    setSubmitLoading(true);
    try {
      await login(formData.email, formData.password);
      navigate('/dashboard');
    } catch (error: any) {
      setApiError(error.message || 'Login failed');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            borderRadius: 2,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              mb: 3,
            }}
          >
            <Business
              sx={{
                fontSize: 40,
                color: 'primary.main',
                mr: 1,
              }}
            />
            <Box>
              <Typography component="h1" variant="h4" fontWeight="bold">
                Kenafric
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Meeting Room Booking System
              </Typography>
            </Box>
          </Box>

          <Typography component="h2" variant="h5" sx={{ mb: 3 }}>
            Sign In
          </Typography>

          {apiError && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
              {apiError}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              autoFocus
              value={formData.email}
              onChange={handleChange}
              error={!!errors.email}
              helperText={errors.email}
              disabled={submitLoading}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              error={!!errors.password}
              helperText={errors.password}
              disabled={submitLoading}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2, py: 1.5 }}
              disabled={submitLoading}
              startIcon={submitLoading ? <CircularProgress size={20} /> : null}
            >
              {submitLoading ? 'Signing In...' : 'Sign In'}
            </Button>
            <Grid container justifyContent="center">
              <Grid item>
                <Link
                  to="/register"
                  style={{
                    textDecoration: 'none',
                    color: '#1976d2',
                    fontSize: '0.875rem',
                  }}
                >
                  {"Don't have an account? Register here"}
                </Link>
              </Grid>
            </Grid>
          </Box>

          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Default Admin Login:
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              admin@kenafric.com / admin123
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login;