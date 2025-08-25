# Practika Deployment Guide

This guide will help you deploy the cleaned-up Practika application to Heroku.

## 🚀 Quick Deploy

### 1. Prerequisites

- Heroku CLI installed and logged in
- Git repository with Heroku remote configured
- Python 3.9+ installed locally

### 2. One-Command Deployment

```bash
# Make the deployment script executable
chmod +x deploy-heroku-simple.sh

# Run the deployment script
./deploy-heroku-simple.sh
```

The script will:
- Set environment variables
- Push code to Heroku
- Run database migrations
- Collect static files
- Restart the application
- Verify deployment

## 🔧 Manual Deployment

### 1. Set Environment Variables

```bash
# Set Django environment
heroku config:set DJANGO_ENVIRONMENT=production
heroku config:set DJANGO_DEBUG=False

# Set a secret key (if not already set)
heroku config:set DJANGO_SECRET_KEY="your-secret-key-here"
```

### 2. Deploy Code

```bash
# Push to Heroku
git push heroku main

# Run migrations
heroku run python manage.py migrate

# Collect static files
heroku run python manage.py collectstatic --noinput

# Restart the app
heroku restart
```

### 3. Verify Deployment

```bash
# Check app status
heroku open

# View logs
heroku logs --tail
```

## 🏗️ Architecture Changes Made

### 1. Simplified Settings

- **Removed**: Complex middleware dependencies
- **Removed**: Redis requirements
- **Removed**: S3 complexity (optional)
- **Added**: Clean production settings
- **Added**: Essential middleware only

### 2. New Files Created

- `practika_project/settings_production.py` - Clean production settings
- `core/middleware.py` - Essential middleware classes
- `deploy-heroku-simple.sh` - Automated deployment script
- `env.production.template` - Environment variables template

### 3. Updated Files

- `practika_project/wsgi.py` - Uses new production settings
- `gunicorn.conf.py` - Simplified configuration
- `core/views.py` - Enhanced health check

## 🔍 Troubleshooting

### Common Issues

#### 1. Application Error (H10)

```bash
# Check logs
heroku logs --tail

# Common causes:
# - Missing environment variables
# - Database connection issues
# - Static files not collected
```

#### 2. Database Connection Issues

```bash
# Check if DATABASE_URL is set
heroku config:get DATABASE_URL

# Test database connection
heroku run python manage.py dbshell
```

#### 3. Static Files Not Loading

```bash
# Recollect static files
heroku run python manage.py collectstatic --noinput

# Check static files configuration
heroku run python manage.py check --deploy
```

### Debug Commands

```bash
# Check environment variables
heroku config

# Check app info
heroku apps:info

# Check build logs
heroku builds

# Check release info
heroku releases
```

## 📱 Testing

### Local Testing

```bash
# Run local test suite
python3 test_local.py

# Start local server
python3 manage.py runserver
```

### Production Testing

```bash
# Test health endpoint
curl https://your-app.herokuapp.com/core/health/

# Test home page
curl https://your-app.herokuapp.com/
```

## 🔒 Security

### Environment Variables

- `DJANGO_SECRET_KEY` - Required for production
- `DJANGO_ENVIRONMENT` - Set to 'production'
- `DJANGO_DEBUG` - Set to 'False'

### Security Features

- HTTPS redirect (handled by Heroku)
- Security headers
- CORS protection
- CSRF protection

## 📊 Monitoring

### Health Check Endpoint

- **URL**: `/core/health/`
- **Method**: GET
- **Response**: JSON with system status
- **Use**: Load balancer health checks

### Logs

```bash
# View real-time logs
heroku logs --tail

# View specific log levels
heroku logs --tail --source app --level error
```

## 🚀 Performance

### Optimizations Made

- Single worker process for stability
- Simplified middleware stack
- Efficient static file serving with WhiteNoise
- Database connection pooling

### Scaling

```bash
# Scale workers (if needed)
heroku ps:scale web=2

# Check current dyno usage
heroku ps
```

## 📚 Next Steps

1. **Monitor**: Watch logs for any errors
2. **Test**: Verify all endpoints work
3. **Optimize**: Add Redis/S3 if needed later
4. **Scale**: Increase workers if traffic grows

## 🆘 Support

If you encounter issues:

1. Check the logs: `heroku logs --tail`
2. Verify environment variables: `heroku config`
3. Test locally: `python3 test_local.py`
4. Check this guide for common solutions

---

**Remember**: The application is now simplified and should work reliably on Heroku. All complex dependencies have been removed or made optional.
