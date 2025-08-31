# AWS Resources ERD - Practika Application

## Entity Relationship Diagram of AWS Resources (Costing Money)

```mermaid
graph TB
    %% Networking Layer (High Cost)
    VPC[VPC<br/>10.0.0.0/16<br/>$0.00/month]
    IGW[Internet Gateway<br/>$0.00/month]
    NAT[NAT Gateway<br/>$0.045/hour + data<br/>~$32.40/month]
    EIP[Elastic IP<br/>$0.00/month if attached]
    
    %% Subnets (No direct cost)
    PS1[Public Subnet 1<br/>10.0.1.0/24]
    PS2[Public Subnet 2<br/>10.0.2.0/24]
    PRS1[Private Subnet 1<br/>10.0.3.0/24]
    PRS2[Private Subnet 2<br/>10.0.4.0/24]
    
    %% Security Groups (No direct cost)
    ALBSG[ALB Security Group<br/>Ports: 80,443]
    ECSSG[ECS Security Group<br/>Port: 8000]
    RDSSG[RDS Security Group<br/>Port: 5432]
    
    %% Compute Layer (High Cost)
    ECS[ECS Cluster<br/>Fargate<br/>$0.04048/vCPU-hour<br/>$0.004445/GB-hour]
    ECS_SERVICE[ECS Service<br/>2 tasks<br/>256 CPU + 512MB RAM<br/>~$60/month]
    TASK_DEF[Task Definition<br/>Django App Container]
    
    %% Load Balancer (Medium Cost)
    ALB[Application Load Balancer<br/>$0.0225/hour<br/>~$16.20/month]
    TG[Target Group<br/>Health Check: /core/health/]
    HTTP_L[HTTP Listener<br/>Port 80 → HTTPS redirect]
    HTTPS_L[HTTPS Listener<br/>Port 443]
    
    %% Database Layer (Medium Cost)
    RDS[RDS PostgreSQL<br/>db.t3.micro<br/>$0.017/hour<br/>~$12.24/month]
    DB_SG[DB Subnet Group]
    DB_STORAGE[GP2 Storage<br/>20GB<br/>$0.10/GB-month<br/>~$2.00/month]
    
    %% Storage Layer (Low Cost)
    S3_MEDIA[S3 Bucket<br/>practika-videos<br/>$0.023/GB-month]
    S3_STATIC[S3 Bucket<br/>practika-static<br/>$0.023/GB-month]
    
    %% Certificate (Free)
    SSL_CERT[SSL Certificate<br/>ACM<br/>Free]
    
    %% Monitoring (Low Cost)
    CW_LOGS[CloudWatch Logs<br/>$0.50/GB ingested<br/>$0.03/GB stored]
    CW_METRICS[CloudWatch Metrics<br/>Free tier]
    
    %% Email Service (Low Cost)
    SES[SES<br/>$0.10/1000 emails<br/>Free tier: 62K/month]
    
    %% Secrets (Low Cost)
    SECRETS[Secrets Manager<br/>$0.40/secret/month]
    
    %% IAM Roles (No direct cost)
    ECS_EXEC_ROLE[ECS Task Execution Role]
    ECS_TASK_ROLE[ECS Task Role]
    DEPLOY_ROLE[Deployment Role]
    
    %% Relationships
    VPC --> IGW
    VPC --> NAT
    NAT --> EIP
    VPC --> PS1
    VPC --> PS2
    VPC --> PRS1
    VPC --> PRS2
    
    PS1 --> ALB
    PS2 --> ALB
    PS1 --> NAT
    PRS1 --> RDS
    PRS2 --> RDS
    
    ALB --> ALBSG
    ECS --> ECSSG
    RDS --> RDSSG
    
    ECS --> ECS_SERVICE
    ECS_SERVICE --> TASK_DEF
    TASK_DEF --> ECS_EXEC_ROLE
    TASK_DEF --> ECS_TASK_ROLE
    
    ALB --> TG
    TG --> ECS_SERVICE
    ALB --> HTTP_L
    ALB --> HTTPS_L
    HTTPS_L --> SSL_CERT
    
    RDS --> DB_SG
    RDS --> DB_STORAGE
    
    ECS_TASK_ROLE --> S3_MEDIA
    ECS_TASK_ROLE --> S3_STATIC
    ECS_TASK_ROLE --> SES
    ECS_TASK_ROLE --> SECRETS
    ECS_TASK_ROLE --> CW_LOGS
    ECS_TASK_ROLE --> CW_METRICS
    
    DEPLOY_ROLE --> ECS
    DEPLOY_ROLE --> ECR[ECR Repository<br/>practika<br/>$0.10/GB-month]
    
    %% Cost Summary
    COST_SUMMARY[Monthly Cost Estimate<br/>NAT Gateway: $32.40<br/>ECS Service: $60.00<br/>ALB: $16.20<br/>RDS: $14.24<br/>S3: ~$5.00<br/>Other: ~$10.00<br/>Total: ~$137.84/month]
    
    style COST_SUMMARY fill:#ff6b6b
    style NAT fill:#ffa500
    style ECS_SERVICE fill:#ffa500
    style ALB fill:#ffa500
    style RDS fill:#ffa500
```

## Cost Breakdown by Service

### High Cost Services (>$30/month)
1. **NAT Gateway**: ~$32.40/month
   - $0.045/hour × 24 hours × 30 days
   - Plus data processing charges

2. **ECS Fargate Service**: ~$60.00/month
   - 2 tasks × 256 CPU units × $0.04048/vCPU-hour × 24 × 30
   - 2 tasks × 512MB RAM × $0.004445/GB-hour × 24 × 30

### Medium Cost Services ($10-30/month)
3. **Application Load Balancer**: ~$16.20/month
   - $0.0225/hour × 24 hours × 30 days

4. **RDS PostgreSQL**: ~$14.24/month
   - Instance: $0.017/hour × 24 × 30 = $12.24
   - Storage: 20GB × $0.10/GB-month = $2.00

### Low Cost Services (<$10/month)
5. **S3 Storage**: ~$5.00/month
   - Depends on data volume stored

6. **CloudWatch Logs**: ~$3.00/month
   - Depends on log volume

7. **Secrets Manager**: ~$0.40/month
   - $0.40 per secret

8. **SES Email**: ~$1.00/month
   - Free tier covers most usage

9. **ECR Storage**: ~$1.00/month
   - Depends on image size

## Cost Optimization Recommendations

### Immediate Savings ($50-70/month)
1. **Remove NAT Gateway** ($32.40/month)
   - Use public subnets for ECS tasks
   - Or use VPC endpoints for AWS services

2. **Reduce ECS Tasks** ($30.00/month)
   - Run 1 task instead of 2 during low traffic
   - Use auto-scaling based on demand

3. **Use Spot Instances** ($20-40/month)
   - Switch to FARGATE_SPOT for non-critical workloads

### Medium-term Savings ($20-30/month)
4. **Optimize RDS**
   - Use db.t3.micro for dev/staging
   - Consider Aurora Serverless for production

5. **Optimize Storage**
   - Implement S3 lifecycle policies
   - Compress logs before CloudWatch

### Long-term Savings
6. **Reserved Instances**
   - Commit to 1-year terms for predictable workloads

7. **Multi-region optimization**
   - Use CloudFront for static content
   - Consider Lambda@Edge for edge processing

## Resource Dependencies

### Critical Path (Must be running)
- VPC → Subnets → Security Groups
- ECS Cluster → ECS Service → Task Definition
- ALB → Target Group → ECS Service
- RDS → DB Subnet Group → Private Subnets

### Optional Resources (Can be stopped to save money)
- NAT Gateway (if using public subnets)
- Additional ECS tasks (scale down)
- CloudWatch detailed monitoring
- SES (if not sending emails)

### Free Tier Resources
- SSL Certificate (ACM)
- CloudWatch basic metrics
- SES (62K emails/month)
- ECR (500MB storage)
