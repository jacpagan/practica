# 🚀 Production-Like Development Workflow

This document outlines the production-like development workflow that bridges the gap between local development and production, enabling faster iterations and earlier issue detection.

## 📋 **Overview**

We've implemented a 3-tier deployment strategy:
- **Development**: Local development with Docker (mirrors production)
- **Staging**: Production-like testing environment 
- **Production**: Live production environment

## 🏗️ **Architecture**

Each environment runs the same stack:
- **Backend**: Django + PostgreSQL + Redis
- **Frontend**: React (Vite)
- **Containerization**: Docker + Docker Compose
- **Monitoring**: Health checks and logging

## 🚀 **Quick Start**

### **1. Development Environment**
```bash
# Setup development environment
./scripts/dev-setup.sh

# Access your app
# Backend:  http://localhost:8000
# Frontend: http://localhost:3000
# Admin:    http://localhost:8000/admin/
```

### **2. Staging Environment**
```bash
# Deploy to staging
./scripts/staging-deploy.sh

# Access staging
# Backend:  http://localhost:8001
# Frontend: http://localhost:3001
# Admin:    http://localhost:8001/admin/
```

### **3. Production Environment**
```bash
# Deploy to production (requires confirmation)
./scripts/prod-deploy.sh

# Access production
# Backend:  http://localhost:8000
# Frontend: http://localhost:3000
# Admin:    http://localhost:8000/admin/
```

## 📁 **File Structure**

```
Practika/
├── docker-compose.yml              # Development environment
├── docker-compose.staging.yml      # Staging environment  
├── docker-compose.prod.yml         # Production environment
├── .env.development                 # Development config
├── .env.staging                     # Staging config
├── .env.production                  # Production config
├── scripts/
│   ├── dev-setup.sh                # Development setup
│   ├── staging-deploy.sh           # Staging deployment
│   └── prod-deploy.sh              # Production deployment
└── DEPLOYMENT.md                   # This file
```

## 🔧 **Environment Configuration**

### **Development (.env.development)**
```bash
DEBUG=1
SECRET_KEY=dev-secret-key-not-for-production
DATABASE_URL=postgresql://practica:practica123@localhost:5432/practica
REDIS_URL=redis://localhost:6379/0
ALLOWED_HOSTS=localhost,127.0.0.1
API_URL=http://localhost:8000
```

### **Staging (.env.staging)**
```bash
DEBUG=0
SECRET_KEY=staging-secret-key-change-me
POSTGRES_PASSWORD=staging-password-123
ALLOWED_HOSTS=localhost,127.0.0.1,staging.yourdomain.com
API_URL=http://localhost:8001
```

### **Production (.env.production)**
```bash
DEBUG=0
SECRET_KEY=your-super-secret-production-key
POSTGRES_PASSWORD=your-super-secure-production-password
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
API_URL=https://api.yourdomain.com
```

## 🔄 **Daily Workflow**

### **Morning Setup**
```bash
# Pull latest changes
git pull origin main

# Start development environment
./scripts/dev-setup.sh

# Verify everything works
curl http://localhost:8000/health/
```

### **During Development**
```bash
# Make code changes locally
# Test in Docker environment
docker-compose exec backend python manage.py test

# Deploy to staging for validation
./scripts/staging-deploy.sh

# Test staging environment
curl http://localhost:8001/health/
```

### **Before Production**
```bash
# Run full test suite in staging
docker-compose -f docker-compose.staging.yml exec backend python manage.py test

# Deploy to production (with confirmation)
./scripts/prod-deploy.sh

# Monitor production health
curl http://localhost:8000/health/
```

## 🏥 **Health Monitoring**

### **Health Check Endpoint**
```bash
# Development
curl http://localhost:8000/health/

# Staging  
curl http://localhost:8001/health/

# Production
curl http://localhost:8000/health/
```

### **Health Check Response**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-05T22:30:00.000Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "models": "healthy"
  },
  "version": "1.0.0",
  "environment": "development"
}
```

## 🧪 **Testing Strategy**

### **Development Testing**
```bash
# Run all tests
docker-compose exec backend python manage.py test

# Run specific test
docker-compose exec backend python manage.py test videos.tests.test_models

# Run with coverage
docker-compose exec backend coverage run manage.py test
```

### **Staging Testing**
```bash
# Run tests in staging environment
docker-compose -f docker-compose.staging.yml exec backend python manage.py test

# Performance testing
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8001/api/videos/
```

### **Production Testing**
```bash
# Health check
curl http://localhost:8000/health/

# Critical path testing
curl http://localhost:8000/api/videos/
```

## 📊 **Monitoring & Logging**

### **Container Logs**
```bash
# Development logs
docker-compose logs -f

# Staging logs
docker-compose -f docker-compose.staging.yml logs -f

# Production logs
docker-compose -f docker-compose.prod.yml logs -f
```

### **Service Status**
```bash
# Development status
docker-compose ps

# Staging status
docker-compose -f docker-compose.staging.yml ps

# Production status
docker-compose -f docker-compose.prod.yml ps
```

## 🔒 **Security Considerations**

### **Environment Variables**
- Never commit `.env.*` files to git
- Use different secrets for each environment
- Rotate secrets regularly
- Use strong passwords

### **Production Security**
- Change default admin passwords
- Set up SSL/TLS certificates
- Configure firewall rules
- Enable security headers
- Monitor access logs

## 🚨 **Troubleshooting**

### **Common Issues**

**Container won't start:**
```bash
# Check logs
docker-compose logs backend

# Rebuild containers
docker-compose up --build
```

**Database connection failed:**
```bash
# Check database status
docker-compose ps
docker-compose exec db pg_isready -U practica
```

**Port already in use:**
```bash
# Find and kill process using port
lsof -ti:8000 | xargs kill
```

**Health check failing:**
```bash
# Check individual services
curl http://localhost:8000/health/
docker-compose logs backend
```

### **Recovery Procedures**

**Development Environment:**
```bash
# Reset development environment
docker-compose down -v
./scripts/dev-setup.sh
```

**Staging Environment:**
```bash
# Reset staging environment
docker-compose -f docker-compose.staging.yml down -v
./scripts/staging-deploy.sh
```

**Production Environment:**
```bash
# Production rollback (if backup exists)
docker-compose -f docker-compose.prod.yml down
# Restore from backup
psql -U practica -d practica_prod < backup_YYYYMMDD_HHMMSS.sql
docker-compose -f docker-compose.prod.yml up -d
```

## 🎯 **Success Metrics**

### **Deployment Metrics**
- **Deployment Frequency**: Daily deployments to staging
- **Lead Time**: < 1 hour from code to staging
- **Mean Time to Recovery**: < 30 minutes
- **Change Failure Rate**: < 5%

### **Quality Metrics**
- **Test Coverage**: > 80%
- **Code Quality**: No critical issues
- **Performance**: < 2s response time
- **Security**: No high-severity vulnerabilities

## 💡 **Best Practices**

1. **Always test in staging before production**
2. **Keep environment parity as close as possible**
3. **Use health checks for monitoring**
4. **Automate deployments with scripts**
5. **Monitor logs and metrics continuously**
6. **Have rollback procedures ready**
7. **Keep secrets secure and rotated**
8. **Document all changes and procedures**

## 🔧 **Advanced Usage**

### **Custom Environment Variables**
```bash
# Override environment variables
POSTGRES_PASSWORD=custom-password ./scripts/staging-deploy.sh
```

### **Database Operations**
```bash
# Access database shell
docker-compose exec db psql -U practica -d practica

# Create database backup
docker-compose exec db pg_dump -U practica practica > backup.sql

# Restore database
docker-compose exec -T db psql -U practica -d practica < backup.sql
```

### **Scaling Services**
```bash
# Scale backend service
docker-compose up --scale backend=3

# Scale with specific compose file
docker-compose -f docker-compose.prod.yml up --scale backend=3
```

---

## 📞 **Support**

For issues or questions:
1. Check the troubleshooting section above
2. Review container logs: `docker-compose logs`
3. Check health endpoint: `curl http://localhost:8000/health/`
4. Verify environment configuration

This workflow ensures your development environment closely mirrors production, enabling faster iterations and more reliable deployments! 🚀
