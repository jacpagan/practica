#!/bin/bash
# AWS Infrastructure Status Check Script

echo "📊 Practica AWS Infrastructure Status"
echo "====================================="

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
    echo "❌ No Terraform state found. Infrastructure not deployed."
    echo "💡 Run './deploy-aws.sh' to deploy infrastructure."
    exit 0
fi

cd infrastructure

# Check if resources exist
if terraform show -json >/dev/null 2>&1; then
    echo "✅ Infrastructure is deployed!"
    
    # Show current resources
    echo ""
    echo "📋 Current AWS Resources:"
    terraform show -json | jq -r '.values.root_module.resources[]? | select(.type | startswith("aws_")) | "  • \(.type): \(.name)"' 2>/dev/null || echo "  (No resources found)"
    
    # Show outputs
    echo ""
    echo "📊 Infrastructure Outputs:"
    terraform output 2>/dev/null || echo "  (No outputs available)"
    
    # Check for changes
    echo ""
    echo "🔍 Checking for pending changes..."
    if terraform plan -var="aws_region=$AWS_REGION" -var="environment=$ENVIRONMENT" -detailed-exitcode >/dev/null 2>&1; then
        echo "✅ No changes needed. Infrastructure is up to date!"
    else
        echo "⚠️  Changes detected. Run './deploy-aws.sh' to apply updates."
    fi
    
else
    echo "❌ Terraform state exists but is invalid."
    echo "💡 Run './deploy-aws.sh' to reinitialize and deploy."
fi

echo ""
echo "💡 Available commands:"
echo "  • ./deploy-aws.sh    - Deploy/update infrastructure"
echo "  • ./cleanup-aws.sh   - Destroy all resources"
echo "  • ./status-aws.sh    - Check current status"
