# 🚀 Practika - Production Deployment Guide

## **Current Architecture (HTTPS Production)**

### **Infrastructure Overview**
- **ECS Fargate**: Django application container
- **RDS PostgreSQL**: Database (db.t3.micro)
- **S3**: Video and media storage
- **Application Load Balancer**: HTTPS termination and routing
- **Route 53**: DNS management
- **ACM**: SSL certificate management

### **Production URLs**
- **Main Application**: `https://practika.jpagan.com/`
- **Health Check**: `https://practika.jpagan.com/core/health/`
- **Admin Panel**: `https://practika.jpagan.com/admin/`

### **Monthly Cost**: ~$35-40/month (71-74% cost reduction from original)

---

## **🔧 Deployment Files**

### **Active Configuration Files**
- `aws-deployment-final.yml` - Main CloudFormation template
- `aws-deployment-https.yml` - HTTPS load balancer setup
- `deploy-final.sh` - Automated deployment script
- `Dockerfile.simple` - Production container
- `start-simple.sh` - Application startup script

### **Documentation**
- `MANUAL_TEST_PLAN_HTTPS.md` - Comprehensive test plan
- `AWS_CONSOLIDATION_SUMMARY.md` - Infrastructure summary
- `CURRENT_ERD.md` - Database schema
- `COSTS_BASELINE.md` - Cost analysis

---

## **🚀 Quick Deployment**

```bash
# Deploy to production
./deploy-final.sh

# Test deployment
curl https://practika.jpagan.com/core/health/

# Monitor costs
aws ce get-cost-and-usage --time-period Start=2025-08-01,End=2025-09-01
```

---

## **🧪 Testing**

Run the comprehensive test plan: `MANUAL_TEST_PLAN_HTTPS.md`

Key test areas:
- HTTPS certificate validation
- HTTP → HTTPS redirect
- Video upload and processing
- Role selection (Student/Teacher)
- Mobile responsiveness
- Performance and security

---

## **📊 Monitoring**

### **Health Checks**
- Application: `https://practika.jpagan.com/core/health/`
- Load Balancer: AWS Console → EC2 → Load Balancers
- ECS Service: AWS Console → ECS → Clusters

### **Logs**
- Application logs: CloudWatch → Log groups → `/ecs/practika-cluster`
- Access logs: Load balancer access logs
- Error logs: Django error logs in CloudWatch

---

## **🔒 Security**

### **Current Security Measures**
- ✅ HTTPS enforced with valid SSL certificate
- ✅ Automatic HTTP → HTTPS redirect
- ✅ Security headers configured
- ✅ S3 private access
- ✅ IAM least privilege
- ✅ Database encryption

### **Security Checklist**
- [ ] SSL certificate valid and trusted
- [ ] Security headers present
- [ ] No mixed content warnings
- [ ] CSRF protection enabled
- [ ] Input validation working
- [ ] Access controls enforced

---

## **💰 Cost Optimization**

### **Current Savings**
- **Original Cost**: ~$137/month
- **Current Cost**: ~$35-40/month
- **Savings**: $97-102/month (71-74% reduction)

### **Cost Breakdown**
- ECS Fargate (1 task): $15-25/month
- RDS PostgreSQL: $12.24/month
- Application Load Balancer: $16.20/month
- S3 Storage: $2-5/month
- Route 53: $1-2/month

### **Optimization Opportunities**
- Monitor usage patterns
- Consider auto-scaling
- Implement S3 lifecycle policies
- Add CloudWatch cost alerts

---

## **🛠️ Troubleshooting**

### **Common Issues**

#### **HTTPS Not Working**
```bash
# Check certificate status
aws acm describe-certificate --certificate-arn arn:aws:acm:us-east-1:164782963509:certificate/38e1452f-2da3-4a76-844f-d906b7b2bf28

# Check load balancer health
aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:us-east-1:164782963509:targetgroup/practika-https-target-group/ec36766fa94e0474
```

#### **Application Not Responding**
```bash
# Check ECS service status
aws ecs describe-services --cluster practika-cluster --services practika-service

# Check application logs
aws logs tail /ecs/practika-cluster --follow
```

#### **Database Issues**
```bash
# Check RDS status
aws rds describe-db-instances --db-instance-identifier practika-db

# Test database connectivity
PGPASSWORD=your_password psql -h practika-db.cwn404is0bz8.us-east-1.rds.amazonaws.com -U practika_admin -d practika
```

### **Emergency Procedures**

#### **Rollback Deployment**
```bash
# Get previous task definition
aws ecs describe-services --cluster practika-cluster --services practika-service

# Rollback to previous version
aws ecs update-service --cluster practika-cluster --service practika-service --task-definition practika-task:previous-revision --force-new-deployment
```

#### **Restart Application**
```bash
# Force new deployment
aws ecs update-service --cluster practika-cluster --service practika-service --force-new-deployment
```

---

## **📈 Scaling**

### **Horizontal Scaling**
```bash
# Scale to 2 tasks
aws ecs update-service --cluster practika-cluster --service practika-service --desired-count 2

# Scale to 3 tasks
aws ecs update-service --cluster practika-cluster --service practika-service --desired-count 3
```

### **Vertical Scaling**
- Update task definition with more CPU/Memory
- Update CloudFormation template
- Deploy changes

---

## **🔄 Maintenance**

### **Regular Tasks**
- [ ] Monitor costs monthly
- [ ] Review security settings quarterly
- [ ] Update dependencies as needed
- [ ] Review and update documentation
- [ ] Test backup and recovery procedures

### **Updates**
- [ ] Security patches
- [ ] Django version updates
- [ ] AWS service updates
- [ ] SSL certificate renewal (automatic)

---

## **📞 Support**

### **AWS Support**
- Infrastructure issues: AWS Console → Support Center
- Cost optimization: AWS Cost Explorer
- Security issues: AWS Security Hub

### **Application Support**
- Django issues: Check application logs
- Database issues: Check RDS metrics
- Performance issues: Check CloudWatch metrics

---

*Last Updated: August 31, 2025*
*Architecture: ECS Fargate + RDS PostgreSQL + S3 + HTTPS ALB*
*Status: Production Ready with HTTPS*
