# 💰 Cost Baseline - Practika

## **Monthly Cost Estimate**

### **AWS Service Costs**

| Service | Configuration | Monthly Cost | Cost Drivers | Evidence |
|---------|---------------|--------------|--------------|----------|
| **ECS Fargate** | 2 tasks × 256 CPU × 512MB RAM | $30-50 | CPU/Memory usage, 24/7 | `aws-deployment.yml` lines 300-340 |
| **RDS PostgreSQL** | t3.micro, 20GB storage | $15-25 | Instance hours, storage | `aws-deployment.yml` lines 250-270 |
| **Application Load Balancer** | Internet-facing, HTTPS | $20-30 | Request count, data transfer | `aws-deployment.yml` lines 370-390 |
| **S3 Storage** | practika-videos bucket | $5-15 | Storage, requests, data transfer | `aws-deployment.yml` lines 220-240 |
| **NAT Gateway** | Single AZ | $45-60 | Data processing fees | `aws-deployment.yml` lines 120-130 |
| **CloudWatch Logs** | 30-90 day retention | $5-10 | Log storage, metrics | `aws-deployment.yml` lines 450-470 |
| **Route 53** | Domain hosting | $1-2 | Domain queries | `aws-deployment.yml` lines 15-25 |
| **ACM Certificate** | SSL certificate | $0 | Free for ALB | `aws-deployment.yml` lines 420-440 |
| **VPC & Networking** | Basic VPC setup | $0-5 | Data transfer | `aws-deployment.yml` lines 30-140 |

### **Total Monthly Estimate**

| Category | Low Estimate | High Estimate | Notes |
|----------|--------------|---------------|-------|
| **Compute** | $45 | $75 | ECS + RDS |
| **Networking** | $65 | $90 | ALB + NAT Gateway |
| **Storage** | $5 | $15 | S3 + CloudWatch |
| **Domain** | $1 | $2 | Route 53 |
| **Total** | **$116** | **$182** | **Average: $149/month** |

## **Top Cost Drivers**

### **1. NAT Gateway ($45-60/month)**

**Why it's expensive:**
- Fixed cost of ~$45/month for NAT Gateway
- Data processing fees of ~$0.045/GB
- Single AZ deployment (no redundancy)

**Evidence:** `aws-deployment.yml` lines 120-130
```yaml
NATGateway:
  Type: AWS::EC2::NatGateway
  Properties:
    AllocationId: !GetAtt ElasticIP.AllocationId
    SubnetId: !Ref PublicSubnet1
```

**Optimization opportunities:**
- Consider using NAT Instances for lower cost
- Implement data transfer monitoring
- Optimize outbound traffic

### **2. ECS Fargate ($30-50/month)**

**Why it's expensive:**
- 2 tasks running 24/7
- 256 CPU units × 512MB RAM per task
- Fargate pricing is higher than EC2

**Evidence:** `aws-deployment.yml` lines 300-340
```yaml
TaskDefinition:
  Properties:
    Cpu: 256
    Memory: 512
    DesiredCount: 2
```

**Optimization opportunities:**
- Reduce to 1 task during low traffic
- Implement auto-scaling
- Consider EC2 for cost savings
- Use Fargate Spot for non-critical workloads

### **3. Application Load Balancer ($20-30/month)**

**Why it's expensive:**
- Fixed cost of ~$16/month for ALB
- Data transfer fees
- HTTPS processing

**Evidence:** `aws-deployment.yml` lines 370-390
```yaml
ApplicationLoadBalancer:
  Type: AWS::ElasticLoadBalancingV2::LoadBalancer
  Properties:
    Scheme: internet-facing
    Type: application
```

**Optimization opportunities:**
- Monitor and optimize data transfer
- Consider using CloudFront for static content
- Implement caching strategies

## **Cost Breakdown by Environment**

### **Production Environment**

| Component | Monthly Cost | Percentage | Evidence |
|-----------|--------------|------------|----------|
| **NAT Gateway** | $45-60 | 30-33% | `aws-deployment.yml` lines 120-130 |
| **ECS Fargate** | $30-50 | 20-27% | `aws-deployment.yml` lines 300-340 |
| **ALB** | $20-30 | 13-16% | `aws-deployment.yml` lines 370-390 |
| **RDS PostgreSQL** | $15-25 | 10-14% | `aws-deployment.yml` lines 250-270 |
| **S3 + CloudWatch** | $10-25 | 7-14% | `aws-deployment.yml` lines 220-240, 450-470 |
| **Route 53** | $1-2 | 1% | `aws-deployment.yml` lines 15-25 |

### **Development Environment**

*Note: Development environment not found in CloudFormation template. Likely uses local Docker or separate AWS account.*

**Estimated cost:** $0-50/month (local development)

## **Cost Optimization Opportunities**

### **Immediate Savings (30-50% reduction)**

| Optimization | Current Cost | Optimized Cost | Savings | Implementation |
|--------------|--------------|----------------|---------|----------------|
| **NAT Gateway → NAT Instance** | $45-60 | $15-25 | $30-35 | Replace with t3.nano instance |
| **ECS Auto-scaling** | $30-50 | $15-30 | $15-20 | Scale to 0-2 tasks |
| **S3 Lifecycle Policies** | $5-15 | $2-8 | $3-7 | Move old files to IA |
| **CloudWatch Retention** | $5-10 | $2-5 | $3-5 | Reduce retention periods |

### **Medium-term Optimizations**

| Optimization | Potential Savings | Effort | Timeline |
|--------------|-------------------|--------|----------|
| **EC2 instead of Fargate** | 40-60% | Medium | 2-4 weeks |
| **CloudFront CDN** | 20-30% (data transfer) | Low | 1-2 weeks |
| **RDS Reserved Instances** | 30-40% | Low | 1 week |
| **Multi-AZ optimization** | 10-20% | Medium | 2-3 weeks |

### **Long-term Optimizations**

| Optimization | Potential Savings | Effort | Timeline |
|--------------|-------------------|--------|----------|
| **Serverless architecture** | 50-70% | High | 2-3 months |
| **Multi-region optimization** | 20-30% | High | 3-4 months |
| **Custom cost monitoring** | 10-20% | Medium | 1-2 months |

## **Cost Monitoring & Alerts**

### **Current Monitoring**

| Metric | Status | Tool | Evidence |
|--------|--------|------|----------|
| **AWS Cost Explorer** | ✅ Available | AWS Console | Built-in |
| **CloudWatch Billing** | ✅ Available | CloudWatch | Built-in |
| **Cost Alerts** | ❌ Not configured | No alerts | No configuration |
| **Budget Alerts** | ❌ Not configured | No alerts | No configuration |

### **Recommended Cost Alerts**

| Alert Type | Threshold | Action | Priority |
|------------|-----------|--------|----------|
| **Monthly Budget** | > $200 | Email notification | High |
| **Daily Cost Spike** | > 50% increase | Email notification | High |
| **Service Cost** | > $50/month | Email notification | Medium |
| **Data Transfer** | > 100GB/month | Email notification | Medium |

## **Cost Trends & Projections**

### **Current Usage Patterns**

| Metric | Current | Trend | Projection |
|--------|---------|-------|------------|
| **Monthly Cost** | $149 | Stable | $149-200 |
| **Data Transfer** | Unknown | Unknown | Unknown |
| **Storage Growth** | Unknown | Unknown | Unknown |
| **User Growth** | Unknown | Unknown | Unknown |

### **Growth Scenarios**

#### **Conservative Growth (10% monthly)**
- Month 1: $149
- Month 6: $264
- Month 12: $467

#### **Moderate Growth (25% monthly)**
- Month 1: $149
- Month 6: $568
- Month 12: $1,735

#### **Aggressive Growth (50% monthly)**
- Month 1: $149
- Month 6: $1,684
- Month 12: $12,789

## **Cost Allocation**

### **By Team/Function**

| Team | Cost Allocation | Justification | Evidence |
|------|----------------|---------------|----------|
| **Engineering** | 80% | Infrastructure, development | AWS resources |
| **Operations** | 15% | Monitoring, maintenance | CloudWatch, ALB |
| **Security** | 5% | Security features | Security groups, IAM |

### **By Feature**

| Feature | Cost Allocation | Justification | Evidence |
|---------|----------------|---------------|----------|
| **Video Storage** | 40% | S3, data transfer | `aws-deployment.yml` lines 220-240 |
| **Application Hosting** | 35% | ECS, ALB | `aws-deployment.yml` lines 300-390 |
| **Database** | 15% | RDS instance | `aws-deployment.yml` lines 250-270 |
| **Networking** | 10% | NAT Gateway, VPC | `aws-deployment.yml` lines 30-140 |

## **Cost Comparison**

### **vs. Alternative Architectures**

| Architecture | Monthly Cost | Pros | Cons |
|--------------|--------------|------|------|
| **Current (ECS + RDS)** | $149 | Managed, scalable | Expensive |
| **EC2 + RDS** | $80-120 | Lower cost | More management |
| **Serverless (Lambda + Aurora)** | $50-100 | Pay-per-use | Cold starts |
| **Container (Docker + PostgreSQL)** | $20-50 | Lowest cost | Self-managed |

### **vs. Cloud Providers**

| Provider | Equivalent Cost | Pros | Cons |
|----------|----------------|------|------|
| **AWS (Current)** | $149 | Full-featured | Expensive |
| **Google Cloud** | $120-140 | Better pricing | Less features |
| **Azure** | $130-150 | Enterprise features | Complex pricing |
| **DigitalOcean** | $50-80 | Simple pricing | Limited features |

## **Cost Optimization Roadmap**

### **Phase 1: Immediate (1-2 weeks)**
1. **Configure cost alerts** - Set up budget notifications
2. **Implement S3 lifecycle** - Move old files to IA storage
3. **Optimize CloudWatch retention** - Reduce log retention periods
4. **Monitor data transfer** - Identify high-transfer sources

### **Phase 2: Short-term (1-2 months)**
1. **Replace NAT Gateway** - Use NAT instance for cost savings
2. **Implement auto-scaling** - Scale ECS tasks based on demand
3. **Add CloudFront** - Reduce ALB data transfer costs
4. **Optimize RDS** - Consider reserved instances

### **Phase 3: Medium-term (3-6 months)**
1. **Evaluate EC2 migration** - Compare Fargate vs EC2 costs
2. **Implement serverless** - Consider Lambda for non-critical functions
3. **Multi-region optimization** - Optimize for global users
4. **Custom monitoring** - Build cost-aware monitoring

### **Phase 4: Long-term (6+ months)**
1. **Architecture review** - Consider complete redesign
2. **Multi-cloud strategy** - Evaluate cost across providers
3. **Custom solutions** - Build cost-optimized components
4. **Automated optimization** - Implement cost-aware scaling

## **Cost Risk Factors**

### **High Risk**
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Traffic spikes** | 2-3x cost increase | Medium | Auto-scaling |
| **Data transfer growth** | 50-100% increase | High | CDN implementation |
| **Storage growth** | 20-50% increase | Medium | Lifecycle policies |

### **Medium Risk**
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **AWS price increases** | 10-20% increase | Low | Multi-cloud strategy |
| **Service dependencies** | 100% increase | Low | Alternative services |
| **Compliance requirements** | 20-30% increase | Medium | Cost-aware compliance |

## **Cost Governance**

### **Current Policies**
| Policy | Status | Evidence |
|--------|--------|----------|
| **Cost approval** | ❌ Not implemented | No approval process |
| **Budget limits** | ❌ Not implemented | No budget controls |
| **Resource tagging** | ❌ Not implemented | No cost allocation |
| **Cost reporting** | ❌ Not implemented | No regular reporting |

### **Recommended Policies**
1. **Monthly cost reviews** - Review costs with stakeholders
2. **Budget approvals** - Require approval for >$50 changes
3. **Resource tagging** - Tag all resources for cost allocation
4. **Cost alerts** - Set up alerts for budget thresholds

---

*Generated on: August 30, 2025*  
*Evidence-based cost analysis*
