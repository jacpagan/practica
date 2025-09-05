#!/bin/bash
# AWS Setup Script for Practica

echo "🔧 Setting up AWS credentials and Terraform variables for Practica"
echo "=================================================================="

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install it first:"
    echo "   brew install awscli"
    echo "   or visit: https://aws.amazon.com/cli/"
    exit 1
fi

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo "❌ Terraform not found. Please install it first:"
    echo "   brew install terraform"
    echo "   or visit: https://terraform.io/downloads"
    exit 1
fi

echo "✅ AWS CLI and Terraform are installed"

# Check AWS credentials
echo "🔍 Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured."
    echo "📝 Please run: aws configure"
    echo "   You'll need:"
    echo "   - AWS Access Key ID"
    echo "   - AWS Secret Access Key"
    echo "   - Default region (us-east-1)"
    echo "   - Default output format (json)"
    exit 1
fi

echo "✅ AWS credentials are configured"

# Show current AWS identity
echo "👤 Current AWS identity:"
aws sts get-caller-identity

# Check if terraform.tfvars exists
if [ ! -f "infrastructure/terraform.tfvars" ]; then
    echo "⚠️  terraform.tfvars not found. Creating from example..."
    cp infrastructure/terraform.tfvars.example infrastructure/terraform.tfvars
    echo "📝 Please edit infrastructure/terraform.tfvars with your values:"
    echo "   - Set a secure db_password"
    echo "   - Adjust aws_region if needed"
    echo "   - Change environment if needed"
    exit 1
fi

echo "✅ terraform.tfvars exists"

# Initialize Terraform
echo "🔧 Initializing Terraform..."
cd infrastructure
terraform init

# Validate configuration
echo "✅ Validating Terraform configuration..."
terraform validate

# Plan infrastructure
echo "📋 Planning infrastructure..."
terraform plan

echo ""
echo "🎉 Setup complete! You can now run:"
echo "   ./deploy-aws.sh"
echo ""
echo "💰 Estimated monthly cost: ~$15-25"
echo "⚠️  This will create real AWS resources that may incur costs"
