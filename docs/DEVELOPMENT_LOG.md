# Practica - Development Log

## 📋 **Overview**
Complete development log with copy-paste commands for replicating the Practica application setup.

**Repository**: [https://github.com/jacpagan/practica](https://github.com/jacpagan/practica)  
**Production**: [https://practica.jpagan.com](https://practica.jpagan.com)

---

## 🗓️ **Development Timeline**

### **Phase 1: Project Cleanup & Setup (September 5, 2025)**

#### **1.1 Project Cleanup**
**Objective**: Clean up codebase, keep only documentation.

**Commands Executed**:
```bash
# Remove application directories
rm -rf apps/

# Remove configuration files
rm -f docker-compose.yml Makefile .dockerignore
rm -rf config/

# Remove AWS-related files
rm -f aws-production-config.txt cloudfront-config*.json route53-change.json s3-bucket-policy.json
rm -rf aws-tools/

# Remove test files
rm -f *.html DOMAIN_CONFIGURATION_STATUS.md FRONTEND_DEPLOYMENT_SUMMARY.md FRONTEND_IMPROVEMENTS_SUMMARY.md YC_DEMO_COMPLETE_SUMMARY.md YC_DEMO_USER_SCENARIOS.md
```

**AWS Infrastructure Cleanup**:
```bash
# Scale down ECS service
aws ecs update-service --cluster practika-cluster --service practika-service --desired-count 0 --region us-east-1
sleep 30

# Delete ECS service and cluster
aws ecs delete-service --cluster practika-cluster --service practika-service --region us-east-1
aws ecs delete-cluster --cluster practika-cluster --region us-east-1

# Delete load balancer
aws elbv2 delete-load-balancer --load-balancer-arn arn:aws:elasticloadbalancing:us-east-1:164782963509:loadbalancer/app/practika-alb/77402d10201a9aa9 --region us-east-1

# Delete target groups
aws elbv2 delete-target-group --target-group-arn arn:aws:elasticloadbalancing:us-east-1:164782963509:targetgroup/practika-tg/64bdaf62b9e763ed --region us-east-1
aws elbv2 delete-target-group --target-group-arn arn:aws:elasticloadbalancing:us-east-1:164782963509:targetgroup/practika-prod/eeef84987c6910fe4 --region us-east-1

# Delete S3 buckets
aws s3 rb s3://practika-jpagan-com --force
aws s3 rb s3://practika-videos --force

# Disable CloudFront distributions
aws cloudfront update-distribution --id ET9WYUO3V1Y26 --distribution-config '{"Enabled":false}' --region us-east-1
aws cloudfront update-distribution --id E3SLBS76709VL --distribution-config '{"Enabled":false}' --region us-east-1
```

**Git Cleanup**:
```bash
git add -A
git commit -m "Clean up Practica project: Remove all code, keep only documentation"
git push origin main
```

#### **1.2 Environment Configuration**
**Objective**: Create proper environment configuration.

**Commands Executed**:
```bash
# Create environment template
cat > .env.template << 'EOF'
# Practica Environment Configuration Template
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key_here

DJANGO_ENVIRONMENT=development
DJANGO_DEBUG=True
DJANGO_SECRET_KEY=your_django_secret_key_here_generate_a_secure_one
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0

DATABASE_ENGINE=django.db.backends.sqlite3
DATABASE_NAME=db.sqlite3

# AWS Services
RDS_HOST=your_rds_endpoint_here
RDS_PORT=5432
RDS_DB_NAME=practica_production
RDS_USERNAME=practica_user
RDS_PASSWORD=your_secure_password_here

S3_BUCKET_NAME=practica-media
S3_REGION=us-east-1
CLOUDFRONT_DOMAIN=your_cloudfront_domain_here

# Security
CORS_ALLOWED_ORIGINS=https://practica.jpagan.com,https://www.practica.jpagan.com
CSRF_TRUSTED_ORIGINS=https://practica.jpagan.com,https://www.practica.jpagan.com

# File Upload
MAX_UPLOAD_SIZE=100MB
ALLOWED_VIDEO_FORMATS=mp4,webm,mov,avi
ALLOWED_IMAGE_FORMATS=jpg,jpeg,png,gif

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_PER_HOUR=1000
EOF

# Get AWS credentials and generate Django secret
AWS_ACCESS_KEY=$(aws configure get aws_access_key_id)
AWS_SECRET_KEY=$(aws configure get aws_secret_access_key)
DJANGO_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")

# Create actual .env file
cat > .env << 'EOF'
# Practica Environment Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIASMXOUPM264T2QBNF
AWS_SECRET_ACCESS_KEY=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

DJANGO_ENVIRONMENT=development
DJANGO_DEBUG=True
DJANGO_SECRET_KEY=D2gUZCc2X3e87zv0VhSBzQXjutQmxy94tVpXI16j8phv6uhCVQPWvwu5kcdPYWW3ExA
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0

DATABASE_ENGINE=django.db.backends.sqlite3
DATABASE_NAME=db.sqlite3

# AWS Services
RDS_HOST=your_rds_endpoint_here
RDS_PORT=5432
RDS_DB_NAME=practica_production
RDS_USERNAME=practica_user
RDS_PASSWORD=your_secure_password_here

S3_BUCKET_NAME=practica-media
S3_REGION=us-east-1
CLOUDFRONT_DOMAIN=your_cloudfront_domain_here

# Security
CORS_ALLOWED_ORIGINS=https://practica.jpagan.com,https://www.practica.jpagan.com
CSRF_TRUSTED_ORIGINS=https://practica.jpagan.com,https://www.practica.jpagan.com

# File Upload
MAX_UPLOAD_SIZE=100MB
ALLOWED_VIDEO_FORMATS=mp4,webm,mov,avi
ALLOWED_IMAGE_FORMATS=jpg,jpeg,png,gif

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_PER_HOUR=1000
EOF

# Update gitignore and commit
echo ".env" >> .gitignore
rm .env.aws
git add .env.template .gitignore
git commit -m "Add environment configuration template and update gitignore"
git push origin main
```

#### **1.3 AWS Infrastructure Setup**
**Objective**: Set up CloudFront distribution and DNS.

**Commands Executed**:
```bash
# Create S3 bucket
aws s3 mb s3://practica-frontend-jpagan-com --region us-east-1

# Create CloudFront distribution
cat > cloudfront-config.json << 'EOF'
{
    "CallerReference": "practica-frontend-$(date +%s)",
    "Comment": "Practica Frontend Distribution",
    "DefaultRootObject": "index.html",
    "Origins": {
        "Quantity": 1,
        "Items": [
            {
                "Id": "S3-practica-frontend",
                "DomainName": "practica-frontend-jpagan-com.s3.amazonaws.com",
                "S3OriginConfig": {
                    "OriginAccessIdentity": ""
                }
            }
        ]
    },
    "DefaultCacheBehavior": {
        "TargetOriginId": "S3-practica-frontend",
        "ViewerProtocolPolicy": "redirect-to-https",
        "ForwardedValues": {
            "QueryString": false,
            "Cookies": {"Forward": "none"}
        },
        "Compress": true
    },
    "CustomErrorResponses": {
        "Quantity": 2,
        "Items": [
            {
                "ErrorCode": 403,
                "ResponsePagePath": "/index.html",
                "ResponseCode": "200"
            },
            {
                "ErrorCode": 404,
                "ResponsePagePath": "/index.html",
                "ResponseCode": "200"
            }
        ]
    },
    "Enabled": true,
    "Aliases": {
        "Quantity": 1,
        "Items": ["practica.jpagan.com"]
    },
    "ViewerCertificate": {
        "ACMCertificateArn": "arn:aws:acm:us-east-1:164782963509:certificate/f6c8c124-6566-4870-8d4a-7b4aba6a55a0",
        "SSLSupportMethod": "sni-only",
        "MinimumProtocolVersion": "TLSv1.2_2021"
    }
}
EOF

aws cloudfront create-distribution --distribution-config file://cloudfront-config.json --region us-east-1

# Create DNS record
cat > route53-practica.json << 'EOF'
{
    "Comment": "Add A record for practica.jpagan.com pointing to CloudFront",
    "Changes": [
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "practica.jpagan.com",
                "Type": "A",
                "AliasTarget": {
                    "DNSName": "dy6j7264pb6fe.cloudfront.net",
                    "EvaluateTargetHealth": false,
                    "HostedZoneId": "Z2FDTNDATAQYW2"
                }
            }
        }
    ]
}
EOF

aws route53 change-resource-record-sets --hosted-zone-id Z08377472TTB9WSCI997G --change-batch file://route53-practica.json

# Create S3 bucket policy
cat > s3-bucket-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowCloudFrontServicePrincipal",
            "Effect": "Allow",
            "Principal": {
                "Service": "cloudfront.amazonaws.com"
            },
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::practica-frontend-jpagan-com/*",
            "Condition": {
                "StringEquals": {
                    "AWS:SourceArn": "arn:aws:cloudfront::164782963509:distribution/EF2AJVQKJITBT"
                }
            }
        }
    ]
}
EOF

aws s3api put-bucket-policy --bucket practica-frontend-jpagan-com --policy file://s3-bucket-policy.json

# Clean up
rm cloudfront-config.json route53-practica.json s3-bucket-policy.json
```

#### **1.4 Repository Rename**
**Objective**: Change repository name from Practika to Practica.

**Commands Executed**:
```bash
# Update README.md
sed -i 's/Practika/Practica/g' README.md
sed -i 's/practika/practica/g' README.md

# Commit changes
git add .
git commit -m "Update project name from Practika to Practica"
git push origin main
```

**Repository Rename Instructions**:
```bash
# MANUAL STEP: Rename repository on GitHub
# 1. Go to https://github.com/jacpagan/practika/settings
# 2. Change "practika" to "practica"
# 3. Click "Rename" button

# After GitHub rename, update local remote URL:
git remote set-url origin https://github.com/jacpagan/practica.git
git remote -v
git fetch origin
```

---

## 🔧 **Infrastructure Status**

### **CloudFront Distribution**
- **ID**: `EF2AJVQKJITBT`
- **Domain**: `dy6j7264pb6fe.cloudfront.net`
- **Status**: ✅ Deployed
- **HTTPS**: ✅ Enabled
- **Aliases**: `practica.jpagan.com`

### **S3 Bucket**
- **Name**: `practica-frontend-jpagan-com`
- **Region**: `us-east-1`
- **Policy**: CloudFront access configured

### **SSL Certificate**
- **Status**: ✅ ISSUED
- **Domain**: `practica.jpagan.com`
- **Type**: Wildcard (*.jpagan.com)

---

## 📋 **Replication Instructions**

### **Prerequisites**:
1. AWS CLI configured
2. Git installed
3. Python 3.8+ installed
4. Node.js 16+ installed
5. Docker installed

### **Step 1: Clone Repository**
```bash
git clone https://github.com/jacpagan/practica.git
cd practica
```

### **Step 2: Set Up Environment**
```bash
cp .env.template .env
nano .env  # Edit with your values
```

### **Step 3: Verify AWS Configuration**
```bash
aws sts get-caller-identity
aws configure get region
```

### **Step 4: Create AWS Resources**
```bash
# Follow AWS infrastructure setup commands from section 1.3
```

### **Step 5: Deploy Application**
```bash
# Follow deployment process from DEPLOYMENT_READINESS_GUIDE.md
```

---

## 🎯 **Next Development Phases**

### **Phase 2: Application Development**
- [ ] Set up Django backend
- [ ] Create React frontend
- [ ] Implement authentication
- [ ] Build video upload
- [ ] Create annotation system

### **Phase 3: Real-time Features**
- [ ] WebSocket connections
- [ ] Real-time collaboration
- [ ] Video processing pipeline
- [ ] Playlist management

### **Phase 4: Production Deployment**
- [ ] Deploy to ECS Fargate
- [ ] Set up monitoring
- [ ] Implement CI/CD
- [ ] Performance optimization

---

*Last Updated: September 5, 2025*
