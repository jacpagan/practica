#!/bin/bash

# Script to run Django migrations on the new database
set -e

echo "🔧 Running Django migrations on the new database..."

# Create a task to run Django migrations
cat > /tmp/migrations-task.json << 'EOF'
{
  "family": "practika-migrations",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::164782963509:role/practika-infrastructure-ECSTaskExecutionRole-xRac1BaF7B4B",
  "taskRoleArn": "arn:aws:iam::164782963509:role/practika-infrastructure-ECSTaskRole-mov072bsuoUU",
  "containerDefinitions": [
    {
      "name": "practika-migrations",
      "image": "164782963509.dkr.ecr.us-east-1.amazonaws.com/practika:latest",
      "command": ["python", "manage.py", "migrate", "--noinput"],
      "environment": [
        {"name": "DJANGO_ENVIRONMENT", "value": "production"},
        {"name": "DJANGO_DEBUG", "value": "False"},
        {"name": "DJANGO_ALLOWED_HOSTS", "value": "*"},
        {"name": "DJANGO_SECRET_KEY", "value": "{{resolve:secretsmanager:practika-secret-key:SecretString:secret-key}}"},
        {"name": "DATABASE_URL", "value": "postgresql://practika_admin:YourSecurePassword123!@practika-prod-db-v2.cwn404is0bz8.us-east-1.rds.amazonaws.com:5432/practika"},
        {"name": "DJANGO_CSRF_TRUSTED_ORIGINS", "value": "https://jpagan.com,https://practika.jpagan.com,https://jacpagan.com,https://practika.jacpagan.com"},
        {"name": "DJANGO_CSRF_COOKIE_SECURE", "value": "True"},
        {"name": "DJANGO_SESSION_COOKIE_SECURE", "value": "True"},
        {"name": "USE_S3", "value": "True"},
        {"name": "AWS_STORAGE_BUCKET_NAME", "value": "practika-prod-media-bucket"},
        {"name": "AWS_S3_REGION_NAME", "value": "us-east-1"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/practika-prod",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "migrations"
        }
      }
    }
  ]
}
EOF

echo "🚀 Registering task definition..."
aws ecs register-task-definition --cli-input-json file:///tmp/migrations-task.json

echo "🚀 Running migrations task..."
TASK_ARN=$(aws ecs run-task \
  --cluster practika-prod-cluster \
  --task-definition practika-migrations \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-0276554a8681d26e7,subnet-09d114f4ee170cf50],securityGroups=[sg-039a88448bf1a171c],assignPublicIp=ENABLED}" \
  --query 'tasks[0].taskArn' \
  --output text)

echo "📊 Migrations task started: $TASK_ARN"

# Wait for completion
echo "⏳ Waiting for migrations to complete..."
aws ecs wait tasks-stopped --cluster practika-prod-cluster --tasks $TASK_ARN

# Check result
TASK_STATUS=$(aws ecs describe-tasks --cluster practika-prod-cluster --tasks $TASK_ARN --query 'tasks[0].lastStatus' --output text)
echo "✅ Migrations completed with status: $TASK_STATUS"

# Clean up
echo "🧹 Cleaning up..."
rm -f /tmp/migrations-task.json

echo "🎉 Migrations completed!"
echo "🌐 Now testing the application..."

# Test the application
sleep 10
curl -I https://practika.jpagan.com/exercises/
