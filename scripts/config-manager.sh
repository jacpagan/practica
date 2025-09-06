#!/bin/bash

# Advanced Configuration Management System
# Centralized configuration for all environments

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_DIR="$PROJECT_ROOT/config"
TEMPLATES_DIR="$CONFIG_DIR/templates"
SECRETS_DIR="$CONFIG_DIR/secrets"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Create directories
mkdir -p "$CONFIG_DIR" "$TEMPLATES_DIR" "$SECRETS_DIR"

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

# Generate secure secrets
generate_secret() {
    local length=${1:-32}
    openssl rand -hex "$length"
}

# Create environment configuration template
create_env_template() {
    local env=$1
    local template_file="$TEMPLATES_DIR/.env.$env.template"
    
    log "Creating $env environment template..."
    
    case "$env" in
        "development")
            cat > "$template_file" << EOF
# Development Environment Configuration
DEBUG=1
SECRET_KEY=dev-secret-key-change-me
DATABASE_URL=postgresql://practica:practica123@localhost:5432/practica
REDIS_URL=redis://localhost:6379/0
ALLOWED_HOSTS=localhost,127.0.0.1
API_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000

# Database Configuration
POSTGRES_DB=practica
POSTGRES_USER=practica
POSTGRES_PASSWORD=practica123
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Media Files
MEDIA_URL=/media/
MEDIA_ROOT=media/

# Static Files
STATIC_URL=/static/
STATIC_ROOT=staticfiles/

# Logging
LOG_LEVEL=DEBUG
LOG_FILE=logs/development.log

# Security
CSRF_TRUSTED_ORIGINS=http://localhost:3000
CORS_ALLOWED_ORIGINS=http://localhost:3000
CORS_ALLOW_CREDENTIALS=True

# Email (Development)
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
EMAIL_HOST=localhost
EMAIL_PORT=587
EMAIL_USE_TLS=False

# File Upload
MAX_UPLOAD_SIZE=100MB
ALLOWED_VIDEO_TYPES=mp4,webm,avi,mov
EOF
            ;;
        "staging")
            cat > "$template_file" << EOF
# Staging Environment Configuration
DEBUG=0
SECRET_KEY=staging-secret-key-change-me
DATABASE_URL=postgresql://practica:staging-password-123@localhost:5433/practica_staging
REDIS_URL=redis://localhost:6380/0
ALLOWED_HOSTS=localhost,127.0.0.1,staging.yourdomain.com
API_URL=http://localhost:8001
FRONTEND_URL=http://localhost:3001

# Database Configuration
POSTGRES_DB=practica_staging
POSTGRES_USER=practica
POSTGRES_PASSWORD=staging-password-123
POSTGRES_HOST=localhost
POSTGRES_PORT=5433

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_DB=0

# Media Files
MEDIA_URL=/media/
MEDIA_ROOT=media/

# Static Files
STATIC_URL=/static/
STATIC_ROOT=staticfiles/

# Logging
LOG_LEVEL=INFO
LOG_FILE=logs/staging.log

# Security
CSRF_TRUSTED_ORIGINS=http://localhost:3001
CORS_ALLOWED_ORIGINS=http://localhost:3001
CORS_ALLOW_CREDENTIALS=True

# Email (Staging)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-staging-email@gmail.com
EMAIL_HOST_PASSWORD=your-staging-app-password

# File Upload
MAX_UPLOAD_SIZE=100MB
ALLOWED_VIDEO_TYPES=mp4,webm,avi,mov

# Monitoring
ENABLE_MONITORING=True
MONITORING_INTERVAL=300
SLACK_WEBHOOK=your-staging-slack-webhook
EOF
            ;;
        "production")
            cat > "$template_file" << EOF
# Production Environment Configuration
DEBUG=0
SECRET_KEY=your-super-secret-production-key-change-me
DATABASE_URL=postgresql://practica:your-super-secure-production-password@localhost:5432/practica_prod
REDIS_URL=redis://localhost:6379/0
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
API_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Database Configuration
POSTGRES_DB=practica_prod
POSTGRES_USER=practica
POSTGRES_PASSWORD=your-super-secure-production-password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Media Files
MEDIA_URL=/media/
MEDIA_ROOT=media/

# Static Files
STATIC_URL=/static/
STATIC_ROOT=staticfiles/

# Logging
LOG_LEVEL=WARNING
LOG_FILE=logs/production.log

# Security
CSRF_TRUSTED_ORIGINS=https://yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com
CORS_ALLOW_CREDENTIALS=True
SECURE_SSL_REDIRECT=True
SECURE_HSTS_SECONDS=31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=True
SECURE_HSTS_PRELOAD=True

# Email (Production)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-production-email@gmail.com
EMAIL_HOST_PASSWORD=your-production-app-password

# File Upload
MAX_UPLOAD_SIZE=100MB
ALLOWED_VIDEO_TYPES=mp4,webm,avi,mov

# AWS S3 (Optional)
AWS_ACCESS_KEY_ID=your-production-aws-key
AWS_SECRET_ACCESS_KEY=your-production-aws-secret
AWS_STORAGE_BUCKET_NAME=practica-production-bucket
AWS_S3_REGION_NAME=us-east-1
AWS_S3_CUSTOM_DOMAIN=cdn.yourdomain.com

# Monitoring
ENABLE_MONITORING=True
MONITORING_INTERVAL=60
SLACK_WEBHOOK=your-production-slack-webhook
SENTRY_DSN=your-sentry-dsn

# Performance
CACHE_TTL=3600
REDIS_CACHE_TTL=3600
DATABASE_CONNECTION_POOL_SIZE=20
EOF
            ;;
    esac
    
    log_success "Created $env environment template: $template_file"
}

# Generate environment configuration
generate_env_config() {
    local env=$1
    local output_file=".env.$env"
    
    log "Generating $env environment configuration..."
    
    # Create template if it doesn't exist
    if [ ! -f "$TEMPLATES_DIR/.env.$env.template" ]; then
        create_env_template "$env"
    fi
    
    # Copy template to output
    cp "$TEMPLATES_DIR/.env.$env.template" "$output_file"
    
    # Generate secure secrets
    local secret_key
    secret_key=$(generate_secret 32)
    sed -i.bak "s/SECRET_KEY=.*/SECRET_KEY=$secret_key/" "$output_file"
    
    local db_password
    db_password=$(generate_secret 16)
    sed -i.bak "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$db_password/" "$output_file"
    
    # Clean up backup files
    rm -f "$output_file.bak"
    
    log_success "Generated $env environment configuration: $output_file"
    log_warning "Please review and update the configuration file with your specific values"
}

# Validate environment configuration
validate_env_config() {
    local env=$1
    local config_file=".env.$env"
    
    log "Validating $env environment configuration..."
    
    if [ ! -f "$config_file" ]; then
        log_error "Configuration file $config_file not found"
        return 1
    fi
    
    # Load configuration
    source "$config_file"
    
    # Required variables
    local required_vars=(
        "SECRET_KEY"
        "POSTGRES_PASSWORD"
        "ALLOWED_HOSTS"
        "API_URL"
        "FRONTEND_URL"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        log_error "Missing required variables: ${missing_vars[*]}"
        return 1
    fi
    
    # Validate URLs
    if [[ ! "$API_URL" =~ ^https?:// ]]; then
        log_error "Invalid API_URL format: $API_URL"
        return 1
    fi
    
    if [[ ! "$FRONTEND_URL" =~ ^https?:// ]]; then
        log_error "Invalid FRONTEND_URL format: $FRONTEND_URL"
        return 1
    fi
    
    log_success "$env environment configuration is valid"
    return 0
}

# Create Docker Compose configuration
create_docker_compose_config() {
    local env=$1
    local compose_file="docker-compose.$env.yml"
    
    log "Creating $env Docker Compose configuration..."
    
    case "$env" in
        "development")
            cat > "$compose_file" << EOF
version: '3.8'

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: practica
      POSTGRES_USER: practica
      POSTGRES_PASSWORD: practica123
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U practica"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    volumes:
      - ./apps/backend:/app
      - media_volume:/app/media
    environment:
      - DEBUG=1
      - DATABASE_URL=postgresql://practica:practica123@db:5432/practica
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: >
      sh -c "python manage.py migrate &&
             python manage.py collectstatic --noinput &&
             python manage.py runserver 0.0.0.0:8000"

  frontend:
    build:
      context: ./apps/frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    volumes:
      - ./apps/frontend:/app
      - /app/node_modules
    environment:
      - VITE_API_URL=http://localhost:8000
    command: npm run dev

volumes:
  postgres_data:
  media_volume:
EOF
            ;;
        "staging")
            cat > "$compose_file" << EOF
version: '3.8'

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: practica_staging
      POSTGRES_USER: practica
      POSTGRES_PASSWORD: staging-password-123
    ports:
      - "5433:5432"
    volumes:
      - postgres_staging_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U practica"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7
    ports:
      - "6380:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile
    ports:
      - "8001:8000"
    volumes:
      - media_staging_volume:/app/media
    environment:
      - DEBUG=0
      - DATABASE_URL=postgresql://practica:staging-password-123@db:5432/practica_staging
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: >
      sh -c "python manage.py migrate &&
             python manage.py collectstatic --noinput &&
             gunicorn practica.wsgi:application --bind 0.0.0.0:8000 --workers 3"

  frontend:
    build:
      context: ./apps/frontend
      dockerfile: Dockerfile
    ports:
      - "3001:3000"
    environment:
      - VITE_API_URL=http://localhost:8001
    command: npm run build && npm run preview

volumes:
  postgres_staging_data:
  media_staging_volume:
EOF
            ;;
        "production")
            cat > "$compose_file" << EOF
version: '3.8'

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: practica_prod
      POSTGRES_USER: practica
      POSTGRES_PASSWORD: your-super-secure-production-password
    volumes:
      - postgres_prod_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U practica"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7
    volumes:
      - redis_prod_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  backend:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    volumes:
      - media_prod_volume:/app/media
    environment:
      - DEBUG=0
      - DATABASE_URL=postgresql://practica:your-super-secure-production-password@db:5432/practica_prod
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: >
      sh -c "python manage.py migrate &&
             python manage.py collectstatic --noinput &&
             gunicorn practica.wsgi:application --bind 0.0.0.0:8000 --workers 4 --timeout 120"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health/"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./apps/frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=https://api.yourdomain.com
    command: npm run build && npm run preview
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - backend
      - frontend
    restart: unless-stopped

volumes:
  postgres_prod_data:
  redis_prod_data:
  media_prod_volume:
EOF
            ;;
    esac
    
    log_success "Created $env Docker Compose configuration: $compose_file"
}

# Create Nginx configuration
create_nginx_config() {
    log "Creating Nginx configuration..."
    
    cat > "nginx.conf" << EOF
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:8000;
    }
    
    upstream frontend {
        server frontend:3000;
    }
    
    server {
        listen 80;
        server_name yourdomain.com www.yourdomain.com;
        
        # Redirect HTTP to HTTPS
        return 301 https://\$server_name\$request_uri;
    }
    
    server {
        listen 443 ssl http2;
        server_name yourdomain.com www.yourdomain.com;
        
        # SSL Configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;
        
        # Security Headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        
        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
        
        # Backend API
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
        
        # Admin
        location /admin/ {
            proxy_pass http://backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
        
        # Media files
        location /media/ {
            proxy_pass http://backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
        
        # Static files
        location /static/ {
            proxy_pass http://backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
        
        # Health check
        location /health/ {
            proxy_pass http://backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }
}
EOF
    
    log_success "Created Nginx configuration: nginx.conf"
}

# Setup all environments
setup_all_environments() {
    log "Setting up all environments..."
    
    local environments=("development" "staging" "production")
    
    for env in "${environments[@]}"; do
        log "Setting up $env environment..."
        
        # Create templates
        create_env_template "$env"
        
        # Generate configurations
        generate_env_config "$env"
        
        # Create Docker Compose files
        create_docker_compose_config "$env"
        
        echo ""
    done
    
    # Create Nginx configuration
    create_nginx_config
    
    log_success "All environments setup completed"
}

# Main function
main() {
    case "${1:-help}" in
        "template")
            create_env_template "${2:-development}"
            ;;
        "generate")
            generate_env_config "${2:-development}"
            ;;
        "validate")
            validate_env_config "${2:-development}"
            ;;
        "compose")
            create_docker_compose_config "${2:-development}"
            ;;
        "nginx")
            create_nginx_config
            ;;
        "setup")
            setup_all_environments
            ;;
        "help"|*)
            echo "⚙️ Advanced Configuration Management System"
            echo ""
            echo "Usage: $0 [command] [options]"
            echo ""
            echo "Commands:"
            echo "  template [env]    - Create environment template"
            echo "  generate [env]    - Generate environment configuration"
            echo "  validate [env]    - Validate environment configuration"
            echo "  compose [env]     - Create Docker Compose configuration"
            echo "  nginx             - Create Nginx configuration"
            echo "  setup             - Setup all environments"
            echo "  help              - Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 template development  # Create development template"
            echo "  $0 generate staging     # Generate staging configuration"
            echo "  $0 validate production  # Validate production configuration"
            echo "  $0 compose production   # Create production Docker Compose"
            echo "  $0 nginx                # Create Nginx configuration"
            echo "  $0 setup                # Setup all environments"
            echo ""
            ;;
    esac
}

# Run main function
main "$@"
