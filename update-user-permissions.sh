#!/bin/bash

# Script to update the practika-s3-user policy
# This gives you full permissions for end-to-end development

echo "🚀 Updating practika-s3-user permissions for full-stack development..."

# Create the new policy
aws iam create-policy-version \
    --policy-arn arn:aws:iam::164782963509:policy/PractikaDeploymentPolicy \
    --policy-document file://aws-security/iam-policies/practika-s3-user-complete-policy.json \
    --set-as-default \
    --region us-east-1

echo "✅ Policy updated successfully!"
echo ""
echo "Your practika-s3-user now has permissions for:"
echo "📦 S3 - File storage and static files"
echo "🐳 ECR - Docker image management"
echo "⚙️  ECS - Container deployment and management"
echo "🌐 ALB - Load balancer monitoring"
echo "📊 CloudWatch - Metrics and monitoring"
echo "🗄️  RDS - Database monitoring"
echo "🔍 IAM - Read your own permissions"
echo "🌍 VPC - Network configuration"
echo "📝 Logs - Application log access"
echo ""
echo "You can now build and deploy your app end-to-end! 🚀"
