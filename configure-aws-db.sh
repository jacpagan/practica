#!/bin/bash
# AWS Database Configuration Helper Script

echo "🔧 AWS Database Configuration Helper"
echo "====================================="
echo ""

echo "To configure your database for AWS deployment, you need to:"
echo ""
echo "1. Get your AWS RDS PostgreSQL credentials from the AWS Console"
echo "2. Update your .env file with the following variables:"
echo ""

echo "# Database Configuration for AWS RDS PostgreSQL"
echo "DB_HOST=your-rds-endpoint.region.rds.amazonaws.com"
echo "DB_NAME=practika"
echo "DB_USER=practika_admin"
echo "DB_PASSWORD=your-database-password"
echo "DB_PORT=5432"
echo ""
echo "# Or use DATABASE_URL format:"
echo "DATABASE_URL=postgresql://practika_admin:password@your-rds-endpoint.region.rds.amazonaws.com:5432/practika"
echo ""

echo "3. Set the Django settings module to use AWS settings:"
echo "export DJANGO_SETTINGS_MODULE=practika_project.settings_aws"
echo ""

echo "4. Run migrations on the PostgreSQL database:"
echo "python3 manage.py migrate"
echo ""

echo "Current status:"
echo "DJANGO_SETTINGS_MODULE: $DJANGO_SETTINGS_MODULE"
echo ""

if [ "$DJANGO_SETTINGS_MODULE" = "practika_project.settings_aws" ]; then
    echo "✅ Django settings module is correctly set to AWS"
else
    echo "❌ Django settings module is not set to AWS"
    echo "Run: export DJANGO_SETTINGS_MODULE=practika_project.settings_aws"
fi

echo ""
echo "To get your RDS endpoint:"
echo "1. Go to AWS Console → RDS → Databases"
echo "2. Find your database instance"
echo "3. Copy the endpoint (e.g., practika-db.abc123.us-east-1.rds.amazonaws.com)"
echo ""
echo "To get your database credentials:"
echo "1. Check your AWS deployment configuration"
echo "2. Or create a new database user in RDS"
echo ""
