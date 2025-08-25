# 🚀 Heroku Container Deployment Smoke Test Checklist

## 🎯 Pre-Deployment Checks

### Environment Variables
- [ ] `DJANGO_SECRET_KEY` is set and secure
- [ ] `DJANGO_ENVIRONMENT=production`
- [ ] `DJANGO_DEBUG=False`
- [ ] `DJANGO_SETTINGS_MODULE=practika_project.production`
- [ ] `DATABASE_URL` is present (PostgreSQL)
- [ ] `REDIS_URL` is present (Redis)

### S3 Configuration (Optional)
- [ ] `AWS_ACCESS_KEY_ID` is set (if using S3)
- [ ] `AWS_SECRET_ACCESS_KEY` is set (if using S3)
- [ ] `AWS_STORAGE_BUCKET_NAME` is set (if using S3)
- [ ] `AWS_S3_REGION_NAME` is set (if using S3)

## 🐳 Container Build Verification

### Build Phase
- [ ] Docker image builds successfully
- [ ] No build errors in `heroku builds:output`
- [ ] Image size is reasonable (< 1GB)

### Release Phase
- [ ] Migrations run successfully
- [ ] Static files are collected
- [ ] No errors in release logs

## 🌐 Application Health Checks

### Basic Connectivity
- [ ] App responds to HTTP requests
- [ ] No 500 errors on basic endpoints
- [ ] Health check endpoint works: `/health/`
- [ ] App loads without timeout

### Database Connection
- [ ] Database migrations completed
- [ ] Can connect to PostgreSQL
- [ ] No database connection errors in logs
- [ ] Models can be queried

### Static Files
- [ ] CSS files load correctly
- [ ] JavaScript files load correctly
- [ ] Icons and images display
- [ ] No 404s for static assets

## 📱 Core Functionality Tests

### Authentication
- [ ] Login page loads
- [ ] Can authenticate with valid credentials
- [ ] Session management works
- [ ] Logout functionality works

### Exercise Management
- [ ] Exercise list page loads
- [ ] Can view exercise details
- [ ] Admin can create exercises
- [ ] Video playback works

### Video Comments
- [ ] Comment creation works
- [ ] Video recording works (if supported)
- [ ] File uploads work
- [ ] Comment display works

## 🔍 Logging and Monitoring

### Request ID Middleware
- [ ] `X-Request-ID` header is present in responses
- [ ] Request ID appears in error logs
- [ ] Can correlate requests with logs

### Error Logging
- [ ] Errors are logged to stdout
- [ ] No tracebacks in production
- [ ] Request context is preserved
- [ ] Error messages are user-friendly

### Performance Monitoring
- [ ] Response times are reasonable
- [ ] No memory leaks
- [ ] Database queries are optimized
- [ ] Static files are cached

## 🚨 Error Handling

### Graceful Degradation
- [ ] App boots without S3 credentials
- [ ] Fallback to local storage works
- [ ] Missing environment variables handled
- [ ] Database connection failures handled

### User Experience
- [ ] 404 pages are user-friendly
- [ ] 500 errors show appropriate messages
- [ ] Form validation errors are clear
- [ ] Rate limiting works correctly

## 📊 Performance Metrics

### Response Times
- [ ] Home page loads in < 3 seconds
- [ ] API endpoints respond in < 1 second
- [ ] Static files load quickly
- [ ] Database queries are fast

### Resource Usage
- [ ] Memory usage is stable
- [ ] CPU usage is reasonable
- [ ] No excessive disk I/O
- [ ] Network usage is appropriate

## 🔒 Security Verification

### Security Headers
- [ ] `X-Frame-Options: DENY`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-XSS-Protection: 1; mode=block`
- [ ] `Strict-Transport-Security` (if HTTPS)

### Authentication Security
- [ ] Passwords are properly hashed
- [ ] Session cookies are secure
- [ ] CSRF protection is active
- [ ] Rate limiting is enforced

## 📱 Mobile Compatibility

### Responsive Design
- [ ] App works on mobile devices
- [ ] Touch targets are properly sized
- [ ] Navigation is mobile-friendly
- [ ] Forms are usable on small screens

### PWA Features
- [ ] Manifest file is accessible
- [ ] Service worker is registered
- [ ] App can be installed
- [ ] Offline functionality works

## 🧪 Testing Commands

### Health Check
```bash
# Test basic health
curl -f https://your-app.herokuapp.com/health/

# Check response headers
curl -I https://your-app.herokuapp.com/health/
```

### Static Files
```bash
# Test static file serving
curl -f https://your-app.herokuapp.com/static/css/icon-ui.css

# Check static file headers
curl -I https://your-app.herokuapp.com/static/manifest.json
```

### API Endpoints
```bash
# Test API health
curl -f https://your-app.herokuapp.com/api/

# Test with authentication
curl -H "Authorization: Bearer token" https://your-app.herokuapp.com/api/exercises/
```

### Database Connection
```bash
# Test database connectivity
heroku run python manage.py dbshell -c "SELECT 1;"

# Check migrations
heroku run python manage.py showmigrations
```

## 📝 Post-Deployment Verification

### Log Analysis
```bash
# Check for errors
heroku logs --tail | grep -i error

# Check for request IDs
heroku logs --tail | grep "request_id"

# Monitor performance
heroku logs --tail | grep "response_time"
```

### User Testing
- [ ] Test with real users
- [ ] Verify all user flows work
- [ ] Check mobile device compatibility
- [ ] Validate accessibility features

### Monitoring Setup
- [ ] Set up error alerting
- [ ] Configure performance monitoring
- [ ] Set up uptime monitoring
- [ ] Configure log aggregation

## 🚨 Failure Scenarios

### If App Won't Start
1. Check `heroku logs --tail`
2. Verify environment variables
3. Check database connectivity
4. Verify static files are collected

### If Static Files Missing
1. Check `heroku.yml` release phase
2. Verify `STATIC_ROOT` is set
3. Check WhiteNoise configuration
4. Run `heroku run python manage.py collectstatic`

### If Database Errors
1. Check `DATABASE_URL` is set
2. Verify PostgreSQL addon is active
3. Check migration status
4. Verify database permissions

### If S3 Errors
1. Check AWS credentials
2. Verify S3 bucket exists
3. Check bucket permissions
4. Verify region configuration

## ✅ Success Criteria

### Minimum Viable Deployment
- [ ] App responds to HTTP requests
- [ ] No 500 errors on basic endpoints
- [ ] Database connection works
- [ ] Static files are served
- [ ] Basic authentication works

### Production Ready
- [ ] All smoke tests pass
- [ ] Performance metrics are acceptable
- [ ] Security headers are configured
- [ ] Error handling is robust
- [ ] Monitoring is active

### Enterprise Ready
- [ ] Comprehensive logging
- [ ] Performance optimization
- [ ] Security hardening
- [ ] Scalability considerations
- [ ] Disaster recovery plan

---

## 📚 Additional Resources

- [Heroku Container Registry](https://devcenter.heroku.com/articles/container-registry-and-runtime)
- [Django Deployment Checklist](https://docs.djangoproject.com/en/stable/howto/deployment/checklist/)
- [Gunicorn Configuration](https://docs.gunicorn.org/en/stable/configure.html)
- [WhiteNoise Documentation](https://whitenoise.evans.io/)

---

**Last Updated**: [Current Date]
**Version**: 1.0
**Status**: Ready for Production Use
