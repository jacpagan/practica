# AWS Cost-Saving Deployment Script (Idempotent)
#!/bin/bash

echo "🚀 Deploying Practica with AWS Cost-Saving Infrastructure"
echo "========================================================="

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install it first."
    exit 1
fi

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo "❌ Terraform not found. Please install it first."
    exit 1
fi

# Set environment variables
export AWS_REGION=${AWS_REGION:-us-east-1}
export ENVIRONMENT=${ENVIRONMENT:-dev}

echo "📍 AWS Region: $AWS_REGION"
echo "🏷️  Environment: $ENVIRONMENT"

# Check if terraform.tfvars exists
if [ ! -f "infrastructure/terraform.tfvars" ]; then
    echo "⚠️  terraform.tfvars not found. Creating from example..."
    cp infrastructure/terraform.tfvars.example infrastructure/terraform.tfvars
    echo "📝 Please edit infrastructure/terraform.tfvars with your values before continuing."
    echo "   Especially set a secure db_password!"
    exit 1
fi

# Initialize Terraform
echo "🔧 Initializing Terraform..."
cd infrastructure

# Check if Terraform state exists
if [ -f "terraform.tfstate" ] || [ -f ".terraform/terraform.tfstate" ]; then
    echo "📊 Terraform state found. Checking existing resources..."
    
    # Check if resources already exist
    if terraform show -json >/dev/null 2>&1; then
        echo "✅ Infrastructure already exists!"
        
        # Show current state
        echo "📋 Current infrastructure:"
        terraform show -json | jq -r '.values.root_module.resources[]? | select(.type | startswith("aws_")) | "\(.type): \(.name)"' 2>/dev/null || echo "  (No resources found)"
        
        # Check if we need to update anything
        echo "🔍 Checking for changes..."
        if terraform plan -var="aws_region=$AWS_REGION" -var="environment=$ENVIRONMENT" -detailed-exitcode >/dev/null 2>&1; then
            echo "✅ No changes needed. Infrastructure is up to date!"
            
            # Get outputs
            echo "📊 Current infrastructure outputs:"
            terraform output
            
            # Build and deploy application
            echo "🐳 Building Docker containers..."
            cd ..
            docker-compose build
            
            echo "🚀 Starting local development environment..."
            docker-compose up -d
            
            echo "✅ Deployment complete!"
            echo "🌐 Frontend: http://localhost:3000"
            echo "🔧 Backend: http://localhost:8000"
            echo "📊 Database: localhost:5432"
            echo "🗄️  Redis: localhost:6379"
            exit 0
        else
            echo "⚠️  Changes detected. Proceeding with update..."
        fi
    else
        echo "⚠️  Terraform state exists but is invalid. Reinitializing..."
        rm -f terraform.tfstate* .terraform/terraform.tfstate
        terraform init
    fi
else
    echo "🆕 No existing infrastructure found. Creating new resources..."
    terraform init
fi

# Plan infrastructure
echo "📋 Planning infrastructure..."
terraform plan -var="aws_region=$AWS_REGION" -var="environment=$ENVIRONMENT"

# Ask for confirmation
echo ""
echo "⚠️  This will create/update AWS resources that may incur costs."
echo "💰 Estimated monthly cost: ~$15-25"
echo -n "Do you want to proceed? (y/N): "
read -r response
if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled."
    exit 1
fi

# Apply infrastructure
echo "🏗️  Deploying infrastructure..."
terraform apply -var="aws_region=$AWS_REGION" -var="environment=$ENVIRONMENT" -auto-approve

# Get outputs
echo "📊 Infrastructure outputs:"
terraform output

# Build and deploy application
echo "🐳 Building Docker containers..."
cd ..
docker-compose build

echo "🚀 Starting local development environment..."
docker-compose up -d

echo "✅ Deployment complete!"
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:8000"
echo "📊 Database: localhost:5432"
echo "🗄️  Redis: localhost:6379"

echo ""
echo "💰 Cost-saving features enabled:"
echo "  • PostgreSQL db.t3.micro instance"
echo "  • S3 Standard storage"
echo "  • CloudFront PriceClass_100"
echo "  • Minimal backup retention"
echo "  • Single AZ deployment"
