#!/bin/bash
# Update .env file with AWS database configuration

echo "🔧 Updating .env file with AWS database configuration..."
echo ""

# Backup current .env file
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Update .env file with AWS configuration
cat > .env << 'EOF'
# Django Settings
DJANGO_SECRET_KEY=+&e+-kxlu$-kanisjn**n!8yk()0071cq#-oeb@2d@q!d+5=^_
DJANGO_ENVIRONMENT=production
DJANGO_DEBUG=False

# Database Configuration for AWS RDS PostgreSQL
DB_HOST=practika-prod-db-v2.cwn404is0bz8.us-east-1.rds.amazonaws.com
DB_NAME=practika
DB_USER=practika_admin
DB_PASSWORD=your_secure_database_password_here
DB_PORT=5432

# Redis (Docker will use local Redis)
REDIS_URL=redis://redis:6379/1

# AWS S3 Storage Configuration (Required for video uploads)
# Prefer IAM role when running in AWS; keys optional for local only
AWS_ACCESS_KEY_ID=your_aws_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key_here
AWS_STORAGE_BUCKET_NAME=practika-videos
AWS_S3_REGION_NAME=us-east-1

# Optional: Custom S3 domain (if using CloudFront)
# AWS_S3_CUSTOM_DOMAIN=your-cloudfront-domain.com

# Video Upload Settings
MAX_UPLOAD_SIZE=104857600
UPLOAD_RATE_LIMIT=10/minute
RATE_LIMIT_ENABLED=True

# CORS Settings (update with your actual domains)
DJANGO_CORS_ALLOWED_ORIGINS=http://localhost:8000,http://127.0.0.1:8000

# Allowed Hosts (update with your actual domains)
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0
EOF

echo "✅ .env file updated with AWS database configuration"
echo ""
echo "⚠️  IMPORTANT: You need to update the DB_PASSWORD with your actual database password"
echo "   Edit the .env file and replace 'your_secure_database_password_here' with your actual password"
echo ""
echo "   You can find your password in your AWS deployment configuration or CloudFormation stack parameters"
echo ""
echo "Current database endpoint: practika-prod-db-v2.cwn404is0bz8.us-east-1.rds.amazonaws.com"
echo ""
