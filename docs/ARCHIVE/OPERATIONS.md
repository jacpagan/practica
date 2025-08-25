# Practika Platform Operations Guide

**Version**: 1.0  
**Last Updated**: August 25, 2025  
**Status**: Production Ready

## 🚀 **Deployment**

### **Container Stack Deployment (Recommended)**

The platform is deployed using Heroku's container stack with the following configuration:

#### **Prerequisites**
- Heroku CLI installed and logged in
- Docker Desktop running
- Git repository initialized

#### **Quick Deploy Commands**

```bash
# 1. Create new container app
heroku create your-app-name --stack container

# 2. Set required environment variables
heroku config:set DJANGO_SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')"
heroku config:set DJANGO_ENVIRONMENT=production
heroku config:set DJANGO_DEBUG=False
heroku config:set DJANGO_SETTINGS_MODULE=practika_project.production

# 3. Add PostgreSQL and Redis
heroku addons:create heroku-postgresql:essential-0
heroku addons:create heroku-redis:mini

# 4. Deploy container
heroku container:push web
heroku container:release web

# 5. Run release phase commands
heroku run python manage.py migrate
heroku run python manage.py collectstatic --noinput
```

#### **Environment Variables**

**Required:**
```bash
DJANGO_SECRET_KEY=your-secret-key-here
DJANGO_ENVIRONMENT=production
DJANGO_DEBUG=False
DJANGO_SETTINGS_MODULE=practika_project.production
```

**Optional (S3 Storage):**
```bash
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_STORAGE_BUCKET_NAME=your-s3-bucket
AWS_S3_REGION_NAME=us-east-1
```

**Optional (Performance):**
```bash
GUNICORN_WORKERS=1
GUNICORN_TIMEOUT=30
GUNICORN_LOG_LEVEL=info
```

## 🔍 **Monitoring & Debugging**

### **Health Checks**

The platform provides comprehensive health monitoring:

- **Basic Health**: `/core/health/` - System status and component health
- **Metrics**: `/core/metrics/` - Prometheus-style metrics
- **Logs**: `/core/logs/` - Application logs and debugging

### **Logging**

All logs are sent to stdout/stderr for Heroku integration:

```bash
# View real-time logs
heroku logs --tail

# View specific log types
heroku logs --tail | grep ERROR
heroku logs --tail | grep "request_id"
```

### **Request ID Correlation**

Every request gets a unique ID for correlation:

- **Header**: `X-Request-ID` in all responses
- **Logs**: Request ID appears in all log entries
- **Debugging**: Use request ID to trace request flow

## 🧪 **Smoke Testing**

### **Pre-Deployment Checklist**
- [ ] Environment variables configured
- [ ] Database addon active
- [ ] Redis addon active
- [ ] Container image built successfully

### **Post-Deployment Tests**

```bash
# Basic connectivity
curl -f https://your-app.herokuapp.com/

# Health endpoint
curl -f https://your-app.herokuapp.com/core/health/

# API endpoints
curl -f https://your-app.herokuapp.com/core/api/videos/

# Static files
curl -f https://your-app.herokuapp.com/static/manifest.json
```

### **Success Criteria**
- ✅ App responds to HTTP requests
- ✅ No 500 errors on basic endpoints
- ✅ Database connection works
- ✅ Static files are served
- ✅ Health checks pass

## 🚨 **Troubleshooting**

### **Common Issues**

#### **App Won't Start**
1. Check `heroku logs --tail`
2. Verify environment variables
3. Check database connectivity
4. Verify static files are collected

#### **500 Errors**
1. Check middleware configuration
2. Verify CSRF settings
3. Check database migrations
4. Review application logs

#### **Static Files Missing**
1. Verify `STATIC_ROOT` is set
2. Check WhiteNoise configuration
3. Run `collectstatic` manually
4. Verify file permissions

### **Debug Commands**

```bash
# Check app status
heroku ps

# Check environment
heroku config

# Run Django shell
heroku run python manage.py shell

# Check migrations
heroku run python manage.py showmigrations

# Test database
heroku run python manage.py dbshell
```

## 🔄 **Rollback Strategy**

### **Safe Rollback Process**

1. **Identify Last Good Release**
   ```bash
   heroku releases
   ```

2. **Rollback to Previous Version**
   ```bash
   heroku rollback vXX
   ```

3. **Verify Rollback**
   ```bash
   heroku ps
   curl -f https://your-app.herokuapp.com/
   ```

4. **Investigate Issues**
   - Check logs for errors
   - Review recent changes
   - Test locally if possible

### **Rollback Triggers**
- 500 errors on basic endpoints
- Health checks failing
- Database connection issues
- Static file serving problems

## 📊 **Performance Monitoring**

### **Key Metrics**
- **Response Time**: Target < 1 second for API calls
- **Memory Usage**: Monitor dyno memory consumption
- **Database Performance**: Query execution times
- **Static File Delivery**: CDN performance

### **Monitoring Tools**
- **Heroku Metrics**: `heroku metrics:web`
- **Application Logs**: Request timing and errors
- **Database Monitoring**: Connection pool status
- **External Monitoring**: Uptime and performance checks

## 🔒 **Security**

### **Production Security Features**
- **HTTPS Only**: SSL/TLS enforced
- **Security Headers**: X-Frame-Options, X-Content-Type-Options
- **CSRF Protection**: Enabled with proper configuration
- **Rate Limiting**: API endpoint protection
- **Input Validation**: Comprehensive file and data validation

### **Security Monitoring**
- **Failed Login Attempts**: Tracked and logged
- **File Upload Validation**: Malware and type checking
- **Request Logging**: Full audit trail
- **Error Handling**: No sensitive data exposure

## 📱 **Mobile Optimization**

### **Features Enabled**
- **PWA Support**: Progressive Web App capabilities
- **Mobile-First Design**: Responsive layouts
- **Touch Optimization**: Proper touch targets
- **Performance Modes**: Device-specific optimization
- **Offline Support**: Service worker caching

### **Device Compatibility**
- **iPhone SE**: 1st, 2nd, and 3rd generation
- **Android**: 9+ with fallback support
- **Modern Browsers**: Chrome, Firefox, Safari, Edge
- **Legacy Support**: Graceful degradation

## 🚀 **Scaling**

### **Horizontal Scaling**
```bash
# Scale web dynos
heroku ps:scale web=2

# Check scaling status
heroku ps
```

### **Resource Optimization**
- **Database Connection Pooling**: Optimized for production
- **Redis Caching**: Session and data caching
- **Static File Optimization**: WhiteNoise compression
- **CDN Integration**: S3 for media files

## 📚 **Additional Resources**

- **Release Audit**: `docs/RELEASE_AUDIT.md`
- **Smoke Test Checklist**: `HEROKU_SMOKE_TEST.md`
- **Docker Guide**: `DOCKER.md`
- **Mobile Compatibility**: `MOBILE_COMPATIBILITY_SUMMARY.md`

---

**For immediate support**: Check logs with `heroku logs --tail`  
**For deployment issues**: Use rollback with `heroku rollback vXX`  
**For performance issues**: Monitor with `heroku metrics:web`
