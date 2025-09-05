#!/bin/bash
# AWS Infrastructure Cleanup Script

echo "🧹 Cleaning up Practica AWS Infrastructure"
echo "=========================================="

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

# Check if infrastructure exists
if [ ! -f "infrastructure/terraform.tfstate" ] && [ ! -f "infrastructure/.terraform/terraform.tfstate" ]; then
    echo "❌ No Terraform state found. Nothing to clean up."
    exit 0
fi

cd infrastructure

# Show what will be destroyed
echo "📋 Resources that will be destroyed:"
terraform show -json | jq -r '.values.root_module.resources[]? | select(.type | startswith("aws_")) | "\(.type): \(.name)"' 2>/dev/null || echo "  (No resources found)"

# Ask for confirmation
echo ""
echo "⚠️  This will DESTROY all AWS resources and cannot be undone!"
echo "💰 This will stop all charges for these resources."
echo -n "Are you sure you want to destroy everything? (yes/NO): "
read -r response
if [[ ! "$response" == "yes" ]]; then
    echo "❌ Cleanup cancelled."
    exit 0
fi

# Destroy infrastructure
echo "💥 Destroying infrastructure..."
terraform destroy -var="aws_region=$AWS_REGION" -var="environment=$ENVIRONMENT" -auto-approve

# Clean up local state
echo "🧹 Cleaning up local state files..."
rm -f terraform.tfstate* .terraform/terraform.tfstate

echo "✅ Cleanup complete! All AWS resources have been destroyed."
echo "💰 You will no longer be charged for these resources."
