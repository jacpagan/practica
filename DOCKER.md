# Docker Setup for LMS Application

This document provides comprehensive instructions for running the LMS application using Docker.

## 🐳 Prerequisites

- Docker Desktop installed and running
- Docker Compose (included with Docker Desktop)
- At least 2GB of available RAM
- At least 1GB of available disk space

## 🚀 Quick Start

### 1. Development Environment

Start the development environment with a single command:

```bash
make dev-up
# or
./docker-helper.sh dev-up
```

This will:
- Build the Docker image
- Start Django and Redis services
- Run database migrations
- Create default users (admin/admin123, user/user123)
- Make the application available at http://localhost:8000

### 2. Production Environment

Start the production environment:

```bash
make prod-up
# or
./docker-helper.sh prod-up
```

This will:
- Build the production image with gunicorn
- Start Django, Redis, and Nginx services
- Make the application available at http://localhost

## 📋 Available Commands

### Using Makefile

```bash
# Development
make dev-up          # Start development environment
make down            # Stop development services
make logs            # View development logs
make test            # Run test suite
make shell           # Open Django shell

# Production
make prod-up         # Start production environment
make prod-down       # Stop production services
make logs-prod       # View production logs
make shell-prod      # Open Django shell in production

# General
make status          # Show service status
make clean           # Clean up all containers and images
make build           # Build Docker images
make help            # Show available commands

# Django management
make manage CMD='makemigrations'           # Run makemigrations
make manage-prod CMD='collectstatic'      # Run collectstatic in production
```

### Using Docker Helper Script

```bash
# Development
./docker-helper.sh dev-up
./docker-helper.sh down
./docker-helper.sh logs
./docker-helper.sh test

# Production
./docker-helper.sh prod-up
./docker-helper.sh prod-down
./docker-helper.sh logs prod

# Django management
./docker-helper.sh manage makemigrations
./docker-helper.sh manage prod collectstatic

# Status and cleanup
./docker-helper.sh status
./docker-helper.sh clean
```

### Using Docker Compose Directly

```bash
# Development
docker-compose up --build -d
docker-compose down
docker-compose logs -f

# Production
docker-compose -f docker-compose.prod.yml up --build -d
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml logs -f
```

## 🏗️ Architecture

### Development Environment

```
┌─────────────────┐    ┌─────────────────┐
│   Django App    │    │     Redis       │
│   (Port 8000)   │◄──►│   (Port 6379)   │
└─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐
│   Host Port     │
│     8000        │
└─────────────────┘
```

### Production Environment

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Nginx       │    │   Django App    │    │     Redis       │
│   (Port 80)     │───►│   (Port 8000)   │◄──►│   (Port 6379)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐
│   Host Port     │
│      80         │
└─────────────────┘
```

## 🔧 Configuration

### Environment Variables

Copy the environment template and customize as needed:

```bash
cp env.template .env
```

Key configuration options:

- `DJANGO_ENVIRONMENT`: Set to `development` or `production`
- `DJANGO_DEBUG`: Set to `True` or `False`
- `DJANGO_SECRET_KEY`: Your Django secret key
- `DJANGO_ALLOWED_HOSTS`: Comma-separated list of allowed hosts
- `DJANGO_REDIS_URL`: Redis connection string

### Port Configuration

- **Development**: Django runs on port 8000
- **Production**: Nginx runs on port 80, Django on port 8000 (internal)

### Volume Mounts

The following directories are mounted as volumes:

- `./media` → `/app/media` (video uploads)
- `./logs` → `/app/logs` (application logs)
- `./db.sqlite3` → `/app/db.sqlite3` (database)

## 🧪 Testing

Run the test suite in the Docker environment:

```bash
make test
# or
./docker-helper.sh test
```

## 📊 Monitoring

### Health Checks

The application includes health check endpoints:

- `/health/` - Basic health status
- `/api/health/` - Detailed health information
- `/api/metrics/` - Prometheus-style metrics

### Logs

View application logs:

```bash
# Development logs
make logs

# Production logs
make logs-prod

# Follow logs in real-time
docker-compose logs -f web
```

### Status

Check service status:

```bash
make status
# or
docker-compose ps
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Port Already in Use

If port 8000 or 80 is already in use:

```bash
# Check what's using the port
lsof -i :8000
lsof -i :80

# Stop conflicting services or change ports in docker-compose.yml
```

#### 2. Permission Issues

If you encounter permission issues:

```bash
# Fix ownership
sudo chown -R $USER:$USER .

# Or run with elevated permissions (not recommended for production)
sudo docker-compose up
```

#### 3. Database Issues

If the database is corrupted or needs reset:

```bash
# Remove the database file
rm db.sqlite3

# Restart the environment
make down
make dev-up
```

#### 4. Memory Issues

If containers are running out of memory:

```bash
# Check Docker resource usage
docker stats

# Increase Docker Desktop memory allocation
# Docker Desktop → Settings → Resources → Memory
```

### Debug Mode

Enable debug mode for troubleshooting:

```bash
# Set environment variable
export DJANGO_DEBUG=True

# Or modify docker-compose.yml
environment:
  - DJANGO_DEBUG=True
```

## 🔒 Security Considerations

### Development vs Production

- **Development**: Debug mode enabled, less strict security
- **Production**: Debug mode disabled, strict security headers, rate limiting

### Security Features

- Non-root user in containers
- Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- Rate limiting on API endpoints
- File upload validation
- CORS configuration

### Secrets Management

For production, use proper secrets management:

```bash
# Create a .env file with production values
DJANGO_SECRET_KEY=your-production-secret-key
DJANGO_ENVIRONMENT=production
DJANGO_DEBUG=False
```

## 📈 Performance

### Resource Limits

Production environment includes resource limits:

- **Web containers**: 512MB memory, 0.5 CPU
- **Redis**: 256MB memory, 0.25 CPU

### Scaling

Scale the web service in production:

```bash
docker-compose -f docker-compose.prod.yml up --scale web=3
```

### Caching

Redis is used for:
- Session storage
- API response caching
- Rate limiting

## 🗑️ Cleanup

### Remove All Containers and Images

```bash
make clean
# or
./docker-helper.sh clean
```

### Remove Specific Services

```bash
# Stop and remove development services
docker-compose down -v

# Stop and remove production services
docker-compose -f docker-compose.prod.yml down -v
```

### Clean Docker System

```bash
# Remove unused containers, networks, and images
docker system prune -a

# Remove all volumes (WARNING: This will delete all data)
docker volume prune -a
```

## 🔄 Updates

### Update Application

```bash
# Pull latest code
git pull

# Rebuild and restart
make down
make dev-up
```

### Update Dependencies

```bash
# Update requirements.txt
# Then rebuild
make down
make dev-up
```

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Django Deployment Checklist](https://docs.djangoproject.com/en/stable/howto/deployment/checklist/)
- [Gunicorn Documentation](https://gunicorn.org/)
- [Nginx Documentation](https://nginx.org/en/docs/)

## 🆘 Support

If you encounter issues:

1. Check the logs: `make logs` or `make logs-prod`
2. Verify Docker is running: `docker info`
3. Check service status: `make status`
4. Review the troubleshooting section above
5. Check the main README.md for application-specific information
