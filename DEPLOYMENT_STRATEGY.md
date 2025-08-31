# 🚀 Practika Deployment Strategy & GitHub Actions

## Overview

This document outlines the comprehensive deployment strategy for the Practika Django application using GitHub Actions and AWS ECS.

## 🎯 Deployment Strategy

### **Recommended Approach: GitHub Actions + Environment-Based Configuration**

**Why this is optimal for Practika:**

1. **Infrastructure as Code** - Reproducible deployments using CloudFormation
2. **Automated CI/CD** - Push to main branch triggers deployment
3. **Environment Management** - Proper configuration through environment variables
4. **Rolling Updates** - Zero-downtime deployments
5. **Comprehensive Testing** - Pre-deployment validation
6. **Production Monitoring** - Continuous health checks and alerts

## 📋 GitHub Actions Workflows

### 1. **Deploy Workflow** (`.github/workflows/deploy.yml`)

**Triggers:**
- Push to `main` branch
- Pull requests to `main` branch
- Manual workflow dispatch

**Jobs:**
- **Test** - Run unit tests before deployment
- **Build & Deploy** - Build Docker image, push to ECR, deploy to ECS
- **Rollback** - Automatic rollback on deployment failures

**Features:**
- ✅ Automated testing
- ✅ Docker image building and pushing
- ✅ ECS task definition updates
- ✅ Service deployment with health checks
- ✅ Role selection validation
- ✅ Automatic rollback on failure

### 2. **Test Workflow** (`.github/workflows/test.yml`)

**Triggers:**
- Push to any branch
- Pull requests
- Daily scheduled runs

**Jobs:**
- **Unit Tests** - Django test suite with coverage
- **Integration Tests** - Database and service integration
- **Security Tests** - Vulnerability scanning
- **Performance Tests** - Response time validation
- **Student-Teacher Flow Tests** - Core functionality validation
- **Linting & Formatting** - Code quality checks
- **Docker Build Test** - Container validation

### 3. **Monitor Workflow** (`.github/workflows/monitor.yml`)

**Triggers:**
- Every 15 minutes (scheduled)
- Manual health checks

**Jobs:**
- **Health Check** - ECS service status, application health, role selection
- **Alert** - Create GitHub issues for problems

## 🔧 Setup Instructions

### 1. **GitHub Secrets Configuration**

Add these secrets to your GitHub repository:

```bash
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
```

### 2. **AWS Permissions Required**

The AWS user needs these permissions:
- ECR: Push/pull images
- ECS: Update services and task definitions
- CloudFormation: Read stack outputs
- CloudWatch Logs: Read application logs
- ELB: Check target health

### 3. **Environment Variables**

The deployment uses these environment variables:

```bash
AWS_REGION=us-east-1
ECR_REPOSITORY=practika
ECS_CLUSTER=practika-prod-cluster
ECS_SERVICE=practika-prod-service
ECS_TASK_DEFINITION=practika-prod-task
APP_URL=https://practika.jpagan.com
```

## 🚀 Deployment Process

### **Automatic Deployment (Recommended)**

1. **Push to main branch** triggers deployment
2. **Tests run** to validate changes
3. **Docker image built** and pushed to ECR
4. **ECS task definition updated** with new image
5. **Service deployed** with rolling update
6. **Health checks performed** to validate deployment
7. **Role selection tested** to ensure functionality

### **Manual Deployment**

1. Go to GitHub Actions tab
2. Select "Deploy to AWS ECS" workflow
3. Click "Run workflow"
4. Choose environment (production/staging)
5. Monitor deployment progress

## 📊 Monitoring & Alerts

### **Health Checks**

The monitoring workflow checks:
- ✅ ECS service status (running tasks)
- ✅ Application health endpoint
- ✅ Role selection functionality
- ✅ Response time performance
- ✅ Load balancer target health

### **Alerts**

When issues are detected:
- 🚨 GitHub issues created automatically
- 📧 Detailed error information provided
- 🔧 Suggested troubleshooting steps
- ⚡ Quick fix commands included

## 🔄 Rollback Strategy

### **Automatic Rollback**

If deployment fails:
1. Previous task definition identified
2. Service rolled back automatically
3. Issue created with details
4. Team notified immediately

### **Manual Rollback**

```bash
# Get previous task definition
aws ecs describe-services --cluster practika-prod-cluster --services practika-prod-service

# Rollback to previous version
aws ecs update-service --cluster practika-prod-cluster --service practika-prod-service --task-definition practika-prod-task:17 --force-new-deployment
```

## 🛠️ Troubleshooting

### **Common Issues**

1. **ALLOWED_HOSTS Errors**
   - Check environment variable configuration
   - Verify Django settings file
   - Update task definition with correct hosts

2. **ECS Task Failures**
   - Check CloudWatch logs
   - Verify IAM roles and permissions
   - Check resource limits (CPU/Memory)

3. **Load Balancer Health Check Failures**
   - Verify application is responding
   - Check security group rules
   - Validate target group configuration

### **Debug Commands**

```bash
# Check ECS service status
aws ecs describe-services --cluster practika-prod-cluster --services practika-prod-service

# View application logs
aws logs tail /ecs/practika-prod-cluster --follow

# Test application health
curl -v https://practika.jpagan.com/core/health/

# Check role selection
curl -s https://practika.jpagan.com/exercises/login/ | grep "I am a"
```

## 📈 Performance Optimization

### **Current Configuration**

- **ECS Tasks:** 2 instances for high availability
- **CPU:** 256 units per task
- **Memory:** 512 MB per task
- **Health Check:** 30-second intervals
- **Auto Scaling:** Configured for demand

### **Scaling Recommendations**

- Monitor CPU and memory usage
- Adjust task count based on traffic
- Consider auto-scaling policies
- Optimize Docker image size

## 🔒 Security Considerations

### **Current Security Measures**

- ✅ HTTPS enforced
- ✅ Security headers configured
- ✅ CSRF protection enabled
- ✅ Input validation implemented
- ✅ Role-based access control

### **Additional Recommendations**

- Regular security scans
- Dependency vulnerability checks
- Access logging and monitoring
- Regular security updates

## 📝 Maintenance

### **Regular Tasks**

- Monitor GitHub Actions runs
- Review security scan results
- Update dependencies
- Check performance metrics
- Review and update documentation

### **Emergency Procedures**

1. **Service Down**
   - Check ECS service status
   - Review recent deployments
   - Check application logs
   - Rollback if necessary

2. **Performance Issues**
   - Monitor resource usage
   - Check for bottlenecks
   - Scale if needed
   - Optimize code/database

## 🎉 Success Metrics

### **Deployment Success Indicators**

- ✅ All tests passing
- ✅ Zero-downtime deployments
- ✅ Health checks passing
- ✅ Role selection working
- ✅ Response times < 2 seconds

### **Monitoring Success Indicators**

- ✅ 99.9% uptime
- ✅ < 2 second response times
- ✅ No security vulnerabilities
- ✅ All health checks passing
- ✅ Automated alerts working

---

## 🚀 Quick Start

1. **Set up GitHub Secrets** with AWS credentials
2. **Push to main branch** to trigger first deployment
3. **Monitor the deployment** in GitHub Actions
4. **Verify the application** is working correctly
5. **Set up monitoring** for ongoing health checks

The deployment strategy is now fully automated and will handle all future deployments through GitHub Actions!
