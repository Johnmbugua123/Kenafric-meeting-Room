# Deployment Guide - Kenafric Meeting Room Booking System

This guide provides step-by-step instructions for deploying the Kenafric Meeting Room Booking System in various environments.

## 🚀 Quick Start (Development)

### Prerequisites
- Node.js v16+
- MySQL 8.0+
- Git

### 1. Clone and Setup
```bash
git clone <repository-url>
cd kenafric-meeting-room-booking
npm install
npm run backend:install
npm run frontend:install
```

### 2. Database Setup
```bash
# Create MySQL database
mysql -u root -p
CREATE DATABASE kenafric_booking;
exit

# Copy environment file
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials

# Initialize database
cd backend && npm run init-db
```

### 3. Start Development Servers
```bash
# Start both frontend and backend
npm run dev
```

Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Default login: admin@kenafric.com / admin123

## 🏭 Production Deployment

### Option 1: Traditional Server Deployment

#### 1. Server Requirements
- Ubuntu 20.04+ or CentOS 8+
- Node.js 16+ 
- MySQL 8.0+
- Nginx
- SSL certificate
- Minimum 2GB RAM, 20GB storage

#### 2. Install Dependencies
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MySQL
sudo apt install mysql-server
sudo mysql_secure_installation

# Install Nginx
sudo apt install nginx

# Install PM2 for process management
sudo npm install -g pm2
```

#### 3. Application Setup
```bash
# Clone repository
git clone <repository-url> /opt/kenafric-booking
cd /opt/kenafric-booking

# Install dependencies
npm install
npm run backend:install
npm run frontend:install

# Build frontend for production
cd frontend && npm run build

# Setup environment
cp backend/.env.example backend/.env
nano backend/.env  # Configure production settings
```

#### 4. Database Setup
```bash
# Create production database
mysql -u root -p
CREATE DATABASE kenafric_booking_prod;
CREATE USER 'kenafric_user'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON kenafric_booking_prod.* TO 'kenafric_user'@'localhost';
FLUSH PRIVILEGES;
exit

# Initialize database
cd backend && npm run init-db
```

#### 5. Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/kenafric-booking
```

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;

    # Frontend
    location / {
        root /opt/kenafric-booking/frontend/build;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/kenafric-booking /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 6. Process Management with PM2
```bash
cd /opt/kenafric-booking/backend

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'kenafric-booking-api',
    script: 'server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: '/var/log/kenafric-booking/err.log',
    out_file: '/var/log/kenafric-booking/out.log',
    log_file: '/var/log/kenafric-booking/combined.log',
    time: true
  }]
}
EOF

# Create log directory
sudo mkdir -p /var/log/kenafric-booking
sudo chown $USER:$USER /var/log/kenafric-booking

# Start application
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Option 2: Docker Deployment

#### 1. Create Docker Files

**Backend Dockerfile**
```dockerfile
# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
```

**Frontend Dockerfile**
```dockerfile
# frontend/Dockerfile
FROM node:18-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Docker Compose**
```yaml
# docker-compose.yml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: kenafric-db
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: kenafric_booking
      MYSQL_USER: kenafric_user
      MYSQL_PASSWORD: kenafric_password
    volumes:
      - mysql_data:/var/lib/mysql
      - ./backend/scripts/initDatabase.js:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "3306:3306"
    restart: unless-stopped

  backend:
    build: ./backend
    container_name: kenafric-api
    environment:
      NODE_ENV: production
      DB_HOST: mysql
      DB_USER: kenafric_user
      DB_PASSWORD: kenafric_password
      DB_NAME: kenafric_booking
      JWT_SECRET: your-production-jwt-secret
    ports:
      - "5000:5000"
    depends_on:
      - mysql
    restart: unless-stopped

  frontend:
    build: ./frontend
    container_name: kenafric-web
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  mysql_data:
```

#### 2. Deploy with Docker
```bash
# Build and start services
docker-compose up -d

# Initialize database (if needed)
docker-compose exec backend npm run init-db

# View logs
docker-compose logs -f
```

## 🔧 Environment Configuration

### Production Environment Variables

**Backend (.env)**
```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=kenafric_booking_prod
DB_USER=kenafric_user
DB_PASSWORD=secure_database_password

# Security
JWT_SECRET=super-secure-jwt-secret-key-for-production
JWT_EXPIRES_IN=24h

# Server
PORT=5000
NODE_ENV=production

# Email Configuration
EMAIL_HOST=smtp.company.com
EMAIL_PORT=587
EMAIL_USER=booking@kenafric.com
EMAIL_PASSWORD=email_app_password

# Company Settings
COMPANY_NAME=Kenafric
COMPANY_DOMAIN=kenafric.com
```

**Frontend (.env.production)**
```env
REACT_APP_API_URL=https://your-domain.com/api
REACT_APP_APP_NAME=Kenafric Meeting Room Booking
REACT_APP_VERSION=1.0.0
```

## 🔒 Security Checklist

### Pre-Deployment Security
- [ ] Change default admin password
- [ ] Use strong JWT secret (32+ characters)
- [ ] Configure secure database credentials
- [ ] Enable SSL/TLS certificates
- [ ] Set up firewall rules
- [ ] Configure rate limiting
- [ ] Enable request logging
- [ ] Set secure session cookies
- [ ] Configure CORS properly
- [ ] Enable security headers

### Database Security
```sql
-- Create dedicated database user
CREATE USER 'kenafric_app'@'localhost' IDENTIFIED BY 'complex_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON kenafric_booking.* TO 'kenafric_app'@'localhost';

-- Remove test accounts
DELETE FROM mysql.user WHERE User='';
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');

-- Secure configuration
SET GLOBAL local_infile=0;
```

## 📊 Monitoring & Maintenance

### 1. Application Monitoring
```bash
# PM2 monitoring
pm2 monit

# Check application status
pm2 status

# View logs
pm2 logs kenafric-booking-api

# Restart application
pm2 restart kenafric-booking-api
```

### 2. Database Maintenance
```bash
# Backup database
mysqldump -u kenafric_user -p kenafric_booking > backup_$(date +%Y%m%d_%H%M%S).sql

# Automated backup script
cat > /opt/scripts/backup_db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/kenafric"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

mysqldump -u kenafric_user -p$DB_PASSWORD kenafric_booking > $BACKUP_DIR/kenafric_backup_$DATE.sql

# Keep only last 7 days of backups
find $BACKUP_DIR -name "kenafric_backup_*.sql" -mtime +7 -delete
EOF

chmod +x /opt/scripts/backup_db.sh

# Schedule daily backups
echo "0 2 * * * /opt/scripts/backup_db.sh" | sudo crontab -
```

### 3. Log Management
```bash
# Rotate logs
sudo nano /etc/logrotate.d/kenafric-booking
```

```
/var/log/kenafric-booking/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 www-data www-data
    postrotate
        pm2 reloadLogs
    endscript
}
```

## 🚨 Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Check MySQL status
sudo systemctl status mysql

# Check credentials
mysql -u kenafric_user -p kenafric_booking

# Verify environment variables
cd backend && node -e "console.log(process.env.DB_HOST)"
```

**Frontend Build Fails**
```bash
# Clear cache and rebuild
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

**API Not Accessible**
```bash
# Check if backend is running
curl http://localhost:5000/api/health

# Check Nginx configuration
sudo nginx -t
sudo systemctl status nginx

# Check PM2 processes
pm2 status
pm2 logs
```

### Performance Optimization

**Database Optimization**
```sql
-- Add indexes for better performance
CREATE INDEX idx_bookings_user_time ON bookings(user_id, start_time);
CREATE INDEX idx_bookings_room_time ON bookings(room_id, start_time, end_time);
CREATE INDEX idx_users_department ON users(department);
CREATE INDEX idx_users_active ON users(is_active);
```

**Backend Optimization**
```javascript
// Enable compression in production
const compression = require('compression');
app.use(compression());

// Cache static files
app.use(express.static('public', { maxAge: '1d' }));
```

## 📞 Support

For deployment issues:
1. Check application logs: `pm2 logs`
2. Verify database connectivity
3. Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`
4. Contact IT support: IT@kenafric.com

---

**Deployment Guide v1.0 - Kenafric IT Department**