# Practica - Deployment Readiness Guide

## 🚀 **Deployment Checklist**

### **Code Readiness**
- [ ] Frontend builds (`npm run build`)
- [ ] Backend runs locally (`python manage.py runserver`)
- [ ] Tests pass (`pytest`)
- [ ] Environment configured (`.env` file)
- [ ] Docker builds (`docker build`)

### **Infrastructure Readiness**
- [ ] AWS credentials configured (`aws sts get-caller-identity`)
- [ ] SSL certificate valid
- [ ] S3 bucket created
- [ ] CloudFront distribution active
- [ ] DNS record configured

## 🔧 **Current Infrastructure**

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

## 📋 **Deployment Process**

### **Step 1: Build Frontend**
```bash
cd apps/frontend
npm install
npm run build
aws s3 sync dist/ s3://practica-frontend-jpagan-com --delete
```

### **Step 2: Deploy Backend**
```bash
cd apps/backend
docker build -t practica-backend .
docker tag practica-backend:latest 164782963509.dkr.ecr.us-east-1.amazonaws.com/practica-backend:latest
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 164782963509.dkr.ecr.us-east-1.amazonaws.com
docker push 164782963509.dkr.ecr.us-east-1.amazonaws.com/practica-backend:latest
```

### **Step 3: Update ECS Service**
```bash
aws ecs update-service --cluster practica-cluster --service practica-service --force-new-deployment --region us-east-1
```

### **Step 4: Invalidate CloudFront**
```bash
aws cloudfront create-invalidation --distribution-id EF2AJVQKJITBT --paths "/*"
```

## 🎯 **Ready When:**
1. All checklist items checked ✅
2. Local testing passes ✅
3. Build process succeeds ✅
4. Infrastructure configured ✅

---

*Last Updated: September 5, 2025*
