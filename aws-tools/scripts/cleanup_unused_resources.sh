#!/bin/bash
# AWS Resource Cleanup Script
# Removes unused S3 buckets and CloudFront distributions

echo "🧹 AWS Resource Cleanup Script"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🔍 Analyzing resources to be removed..."

# Check if resources exist before attempting removal
echo ""
echo "📋 Resources to be removed:"
echo "1. S3 Bucket: jacpagan-personal-website"
echo "2. CloudFront Distribution: E3KTGGR3KA2SXH (d1lohfkwcfupdb.cloudfront.net)"
echo "3. S3 Bucket: practika-media-prod (empty)"
echo ""

read -p "Do you want to proceed with the cleanup? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo "🚀 Starting cleanup process..."

# Step 1: Disable CloudFront distribution
echo ""
echo "Step 1: Disabling CloudFront distribution..."
if aws cloudfront get-distribution --id E3KTGGR3KA2SXH > /dev/null 2>&1; then
    print_status "Found CloudFront distribution E3KTGGR3KA2SXH"
    
    # Get current config
    aws cloudfront get-distribution-config --id E3KTGGR3KA2SXH > /tmp/cf-config.json
    
    # Disable the distribution
    jq '.DistributionConfig.Enabled = false' /tmp/cf-config.json > /tmp/cf-config-disabled.json
    
    # Update the distribution
    ETAG=$(jq -r '.ETag' /tmp/cf-config.json)
    aws cloudfront update-distribution --id E3KTGGR3KA2SXH --distribution-config file:///tmp/cf-config-disabled.json --if-match "$ETAG" > /dev/null
    
    print_status "CloudFront distribution disabled"
    
    # Wait for deployment
    echo "⏳ Waiting for CloudFront deployment to complete..."
    aws cloudfront wait distribution-deployed --id E3KTGGR3KA2SXH
    print_status "CloudFront deployment completed"
else
    print_warning "CloudFront distribution E3KTGGR3KA2SXH not found"
fi

# Step 2: Delete CloudFront distribution
echo ""
echo "Step 2: Deleting CloudFront distribution..."
if aws cloudfront get-distribution --id E3KTGGR3KA2SXH > /dev/null 2>&1; then
    ETAG=$(aws cloudfront get-distribution --id E3KTGGR3KA2SXH --query 'ETag' --output text)
    aws cloudfront delete-distribution --id E3KTGGR3KA2SXH --if-match "$ETAG" > /dev/null
    print_status "CloudFront distribution E3KTGGR3KA2SXH deleted"
else
    print_warning "CloudFront distribution E3KTGGR3KA2SXH not found"
fi

# Step 3: Delete S3 bucket jacpagan-personal-website
echo ""
echo "Step 3: Deleting S3 bucket jacpagan-personal-website..."
if aws s3api head-bucket --bucket jacpagan-personal-website 2>/dev/null; then
    # Remove website configuration first
    aws s3api delete-bucket-website --bucket jacpagan-personal-website 2>/dev/null || true
    
    # Delete all objects
    aws s3 rm s3://jacpagan-personal-website --recursive 2>/dev/null || true
    
    # Delete bucket
    aws s3api delete-bucket --bucket jacpagan-personal-website
    print_status "S3 bucket jacpagan-personal-website deleted"
else
    print_warning "S3 bucket jacpagan-personal-website not found"
fi

# Step 4: Delete S3 bucket practika-media-prod (empty)
echo ""
echo "Step 4: Deleting S3 bucket practika-media-prod..."
if aws s3api head-bucket --bucket practika-media-prod 2>/dev/null; then
    # Delete bucket (should be empty)
    aws s3api delete-bucket --bucket practika-media-prod
    print_status "S3 bucket practika-media-prod deleted"
else
    print_warning "S3 bucket practika-media-prod not found"
fi

# Cleanup temporary files
rm -f /tmp/cf-config.json /tmp/cf-config-disabled.json

echo ""
echo "🎉 Cleanup completed!"
echo ""
echo "📊 Summary of removed resources:"
echo "✅ CloudFront distribution: E3KTGGR3KA2SXH"
echo "✅ S3 bucket: jacpagan-personal-website"
echo "✅ S3 bucket: practika-media-prod"
echo ""
echo "💰 Estimated monthly savings: $0.01-0.05 (minimal, but cleaner infrastructure)"
echo ""
echo "🔍 Remaining resources:"
echo "📦 S3 bucket: jpagan-personal-website (your main personal site)"
echo "☁️  CloudFront: EXXKNLB63Z22G (serving jpagan-personal-website)"
echo "🗄️  RDS: practika-db"
echo "🐳 ECS: practika-service"
echo "⚖️  ALB: practika-alb"
echo ""
echo "Your infrastructure is now cleaner and more organized!"
