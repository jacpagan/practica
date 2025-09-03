#!/bin/bash

# Practika Documentation Site Deployment Script
# This script helps deploy the documentation to a subdomain

set -e

echo "🚀 Practika Documentation Deployment Script"
echo "============================================="

# Check if we're in the right directory
if [ ! -f "index.html" ]; then
    echo "❌ Error: Please run this script from the docs-site directory"
    echo "   cd docs-site && ./deploy.sh"
    exit 1
fi

echo ""
echo "📋 Deployment Options:"
echo "1. Deploy to AWS S3 + CloudFront (Recommended)"
echo "2. Deploy to Netlify (Free hosting)"
echo "3. Deploy to Vercel (Free hosting)"
echo "4. Deploy to GitHub Pages (Free hosting)"
echo "5. Local development server"
echo ""

read -p "Choose deployment option (1-5): " choice

case $choice in
    1)
        echo ""
        echo "🌐 AWS S3 + CloudFront Deployment"
        echo "=================================="
        echo ""
        echo "This will create:"
        echo "- S3 bucket for static hosting"
        echo "- CloudFront distribution"
        echo "- Route53 subdomain (e.g., docs.jpagan.com)"
        echo ""
        read -p "Enter your desired subdomain (e.g., docs.jpagan.com): " subdomain
        
        if [ -z "$subdomain" ]; then
            echo "❌ Subdomain is required"
            exit 1
        fi
        
        echo ""
        echo "🔧 Setting up AWS infrastructure..."
        
        # Create S3 bucket
        bucket_name=$(echo $subdomain | sed 's/\./-/g')
        echo "Creating S3 bucket: $bucket_name"
        aws s3 mb s3://$bucket_name --region us-east-1
        
        # Configure S3 for static website hosting
        echo "Configuring S3 for static website hosting..."
        aws s3 website s3://$bucket_name --index-document index.html --error-document index.html
        
        # Upload files
        echo "Uploading documentation files..."
        aws s3 sync . s3://$bucket_name --exclude "*.sh" --exclude ".git/*"
        
        # Create CloudFront distribution
        echo "Creating CloudFront distribution..."
        distribution_config=$(cat <<EOF
{
    "CallerReference": "$(date +%s)",
    "Comment": "Practika Documentation",
    "DefaultRootObject": "index.html",
    "Origins": {
        "Quantity": 1,
        "Items": [
            {
                "Id": "S3-$bucket_name",
                "DomainName": "$bucket_name.s3-website-us-east-1.amazonaws.com",
                "CustomOriginConfig": {
                    "HTTPPort": 80,
                    "HTTPSPort": 443,
                    "OriginProtocolPolicy": "http-only"
                }
            }
        ]
    },
    "DefaultCacheBehavior": {
        "TargetOriginId": "S3-$bucket_name",
        "ViewerProtocolPolicy": "redirect-to-https",
        "TrustedSigners": {
            "Enabled": false,
            "Quantity": 0
        },
        "ForwardedValues": {
            "QueryString": false,
            "Cookies": {
                "Forward": "none"
            }
        },
        "MinTTL": 0,
        "Compress": true
    },
    "Enabled": true
}
EOF
)
        
        distribution_id=$(aws cloudfront create-distribution --distribution-config "$distribution_config" --query 'Distribution.Id' --output text)
        
        echo ""
        echo "✅ Deployment complete!"
        echo "🌐 Your documentation is available at:"
        echo "   https://$distribution_id.cloudfront.net"
        echo ""
        echo "📝 Next steps:"
        echo "1. Set up Route53 DNS record pointing to CloudFront"
        echo "2. Configure SSL certificate for your subdomain"
        echo "3. Update DNS to point $subdomain to CloudFront"
        ;;
        
    2)
        echo ""
        echo "🌐 Netlify Deployment"
        echo "====================="
        echo ""
        echo "📋 Prerequisites:"
        echo "- Netlify account (free)"
        echo "- Netlify CLI installed"
        echo ""
        echo "🔧 Steps:"
        echo "1. Install Netlify CLI: npm install -g netlify-cli"
        echo "2. Login: netlify login"
        echo "3. Deploy: netlify deploy --prod"
        echo ""
        echo "Your site will be available at: https://your-site-name.netlify.app"
        ;;
        
    3)
        echo ""
        echo "🌐 Vercel Deployment"
        echo "==================="
        echo ""
        echo "📋 Prerequisites:"
        echo "- Vercel account (free)"
        echo "- Vercel CLI installed"
        echo ""
        echo "🔧 Steps:"
        echo "1. Install Vercel CLI: npm install -g vercel"
        echo "2. Login: vercel login"
        echo "3. Deploy: vercel --prod"
        echo ""
        echo "Your site will be available at: https://your-site-name.vercel.app"
        ;;
        
    4)
        echo ""
        echo "🌐 GitHub Pages Deployment"
        echo "========================="
        echo ""
        echo "📋 Prerequisites:"
        echo "- GitHub repository"
        echo "- GitHub Pages enabled"
        echo ""
        echo "🔧 Steps:"
        echo "1. Create a new GitHub repository"
        echo "2. Push this docs-site folder to the repo"
        echo "3. Enable GitHub Pages in repository settings"
        echo "4. Your site will be available at: https://username.github.io/repo-name"
        ;;
        
    5)
        echo ""
        echo "🚀 Local Development Server"
        echo "=========================="
        echo ""
        echo "Starting local server on http://localhost:8000"
        echo "Press Ctrl+C to stop"
        echo ""
        python3 -m http.server 8000
        ;;
        
    *)
        echo "❌ Invalid choice. Please select 1-5."
        exit 1
        ;;
esac

echo ""
echo "🎉 Deployment script completed!"
echo ""
echo "💡 Tips:"
echo "- Update your DNS settings to point your subdomain to the deployed site"
echo "- Consider setting up SSL certificates for HTTPS"
echo "- Set up monitoring and analytics for your documentation site"
