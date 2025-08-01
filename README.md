# Kenafric Meeting Room Booking System

A comprehensive web-based meeting room booking system designed for Kenafric, a large manufacturing and office complex. This system streamlines room reservations, eliminates double bookings, and improves coordination between staff.

## 🚀 Features

### User Authentication & Authorization
- Secure JWT-based authentication
- Role-based access control (Admin, Manager, Staff)
- User profile management
- Password management

### Room Management
- View all available meeting rooms
- Detailed room information (capacity, features, location)
- Real-time availability checking
- Admin-only room creation, editing, and deletion

### Booking System
- Real-time room booking with conflict detection
- Calendar view of bookings
- Recurring meeting support (daily, weekly, monthly)
- Email notifications for bookings
- Booking cancellation and modification
- Advanced filtering and search

### Dashboard & Analytics
- Personal dashboard with upcoming meetings
- Admin dashboard with system-wide statistics
- Room utilization reports
- Department usage analytics
- Booking trends and insights

### Admin Panel
- User management (create, edit, deactivate users)
- System settings configuration
- Data export functionality
- Comprehensive reporting tools

## 🛠 Technology Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MySQL
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: express-validator
- **Email**: Nodemailer
- **Security**: Helmet, bcryptjs, rate limiting

### Frontend
- **Framework**: React 18 with TypeScript
- **UI Library**: Material-UI (MUI)
- **Routing**: React Router
- **HTTP Client**: Axios
- **Date Handling**: Day.js
- **State Management**: React Context API

### Optional Integrations
- Google Calendar API for calendar synchronization
- Email notifications for booking updates

## 📋 Prerequisites

- Node.js (v16 or higher)
- MySQL (v8.0 or higher)
- npm or yarn package manager

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd kenafric-meeting-room-booking
```

### 2. Install Dependencies
```bash
# Install root dependencies
npm install

# Install backend dependencies
npm run backend:install

# Install frontend dependencies
npm run frontend:install
```

### 3. Database Setup
1. Create a MySQL database named `kenafric_booking`
2. Copy `backend/.env.example` to `backend/.env`
3. Update the database configuration in `backend/.env`:
```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=kenafric_booking
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
JWT_SECRET=your_super_secret_jwt_key_here
```

### 4. Initialize Database
```bash
npm run backend:dev
# In another terminal:
cd backend && npm run init-db
```

### 5. Start the Application
```bash
# Start both frontend and backend concurrently
npm run dev

# Or start separately:
npm run backend:dev   # Backend on http://localhost:5000
npm run frontend:dev  # Frontend on http://localhost:3000
```

## 🔐 Default Login Credentials

After initializing the database, you can log in with:
- **Email**: admin@kenafric.com
- **Password**: admin123

## 📁 Project Structure

```
kenafric-meeting-room-booking/
├── backend/                 # Node.js backend
│   ├── config/             # Database configuration
│   ├── middleware/         # Authentication & validation
│   ├── routes/             # API endpoints
│   ├── scripts/            # Database initialization
│   └── server.js           # Express server
├── frontend/               # React frontend
│   ├── public/             # Static assets
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── contexts/       # React contexts
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   └── types/          # TypeScript definitions
│   └── package.json
├── package.json            # Root package.json
└── README.md
```

## 🔧 Configuration

### Backend Configuration (`backend/.env`)
```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=kenafric_booking
DB_USER=root
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=24h

# Server
PORT=5000
NODE_ENV=development

# Email (Optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@company.com
EMAIL_PASSWORD=your_app_password

# Google Calendar (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### Frontend Configuration (`frontend/.env`)
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_APP_NAME=Kenafric Meeting Room Booking
REACT_APP_VERSION=1.0.0
```

## 📡 API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password

### Room Endpoints
- `GET /api/rooms` - Get all rooms
- `GET /api/rooms/:id` - Get room details
- `POST /api/rooms` - Create room (Admin only)
- `PUT /api/rooms/:id` - Update room (Admin only)
- `DELETE /api/rooms/:id` - Delete room (Admin only)

### Booking Endpoints
- `GET /api/bookings` - Get bookings with filters
- `POST /api/bookings` - Create booking
- `PUT /api/bookings/:id` - Update booking
- `PATCH /api/bookings/:id/cancel` - Cancel booking
- `DELETE /api/bookings/:id` - Delete booking (Admin/Manager)

### Admin Endpoints
- `GET /api/admin/dashboard` - Admin dashboard stats
- `GET /api/admin/reports/usage` - Usage reports
- `GET /api/admin/reports/efficiency` - Efficiency reports

## 🎯 Usage

### For Staff Members
1. **Login** with your employee credentials
2. **View Dashboard** to see upcoming meetings and statistics
3. **Book a Room** by selecting date, time, and room
4. **Manage Bookings** - view, edit, or cancel your reservations
5. **Browse Rooms** to see available meeting spaces

### For Managers
- All staff capabilities plus:
- View and manage bookings for their department
- Access to user statistics and reports

### For Administrators
- All manager capabilities plus:
- **User Management** - create, edit, deactivate users
- **Room Management** - add, edit, remove meeting rooms
- **System Reports** - comprehensive analytics and usage reports
- **System Settings** - configure booking policies and limits

## 🔒 Security Features

- Password hashing with bcrypt
- JWT token authentication
- Rate limiting to prevent abuse
- Input validation and sanitization
- Role-based access control
- SQL injection prevention
- XSS protection with Helmet

## 🚀 Deployment

### Production Build
```bash
# Build frontend for production
cd frontend && npm run build

# Set environment variables for production
export NODE_ENV=production
export JWT_SECRET=your_production_secret
export DB_PASSWORD=your_production_db_password

# Start production server
cd backend && npm start
```

### Environment Setup
1. Set up production MySQL database
2. Configure environment variables
3. Initialize database with production data
4. Set up reverse proxy (nginx) for serving frontend
5. Configure SSL certificates
6. Set up monitoring and logging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Create a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Contact the development team at IT@kenafric.com

## 🔄 Version History

- **v1.0.0** - Initial release with core booking functionality
- **v1.1.0** - Added recurring meetings and calendar integration
- **v1.2.0** - Enhanced admin panel and reporting features

---

**Built with ❤️ for Kenafric Manufacturing**