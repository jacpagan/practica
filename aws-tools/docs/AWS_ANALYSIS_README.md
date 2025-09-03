# AWS Resource Discovery & Cost Analysis

This directory contains tools to discover all AWS resources in your account and analyze costs, following the "READ BEFORE WRITE" principle.

## 🚀 Quick Start

### 1. Setup
```bash
# Run the setup script
./setup_aws_analysis.sh
```

### 2. Run Analysis
```bash
# Basic analysis
python3 aws_cost_analysis.py

# Detailed analysis with resource details
python3 aws_cost_analysis.py --detailed

# Analysis for specific region
python3 aws_cost_analysis.py --region us-west-2
```

## 📋 What the Script Discovers

### **Compute Resources**
- **EC2 Instances**: Running, stopped, and terminated instances
- **ECS Services**: Container orchestration services
- **Lambda Functions**: Serverless functions
- **Load Balancers**: Application and Network Load Balancers

### **Storage Resources**
- **S3 Buckets**: Object storage buckets
- **EBS Volumes**: Block storage volumes
- **RDS Instances**: Database instances
- **ElastiCache**: Redis and Memcached clusters

### **Networking Resources**
- **CloudFront Distributions**: CDN distributions
- **VPC Resources**: Virtual private clouds
- **Security Groups**: Network security rules

### **Cost Analysis**
- **Service Costs**: Breakdown by AWS service
- **Monthly Trends**: Cost trends over time
- **Optimization Recommendations**: Cost-saving suggestions

## 🔍 Discovery Process

The script follows the "READ BEFORE WRITE" principle:

1. **🔍 DISCOVERY PHASE**: Finds all resources using AWS CLI commands
2. **📊 ANALYSIS PHASE**: Analyzes resource configurations and costs
3. **💡 RECOMMENDATION PHASE**: Provides optimization suggestions

### **Example Discovery Commands**
```bash
# Discover EC2 instances
aws ec2 describe-instances --region us-east-1

# Discover RDS instances
aws rds describe-db-instances --region us-east-1

# Discover S3 buckets
aws s3api list-buckets

# Discover ECS services
aws ecs list-services --region us-east-1
```

## 📊 Sample Output

```
🚀 AWS RESOURCE DISCOVERY & COST ANALYSIS REPORT
================================================================================
Region: us-east-1
Generated: 2024-12-02 22:30:15
================================================================================

📊 RESOURCE SUMMARY
----------------------------------------
| Service        | Count |
|================|=======|
| EC2            |     3 |
| RDS            |     1 |
| S3             |     5 |
| ECS            |     2 |
| LoadBalancer   |     1 |
| CloudFront     |     1 |
| Lambda         |     3 |
| ElastiCache    |     0 |
| EBS            |     4 |
----------------------------------------

💰 COST SUMMARY (Last 30 Days)
----------------------------------------
| Service        | Cost   |
|================|========|
| Amazon EC2     | $45.67 |
| Amazon RDS     | $23.45 |
| Amazon S3      | $12.34 |
| Amazon ECS     | $8.90  |
| Amazon Lambda  | $3.21  |
| TOTAL          | $93.57 |
----------------------------------------

💡 RECOMMENDATIONS
----------------------------------------
⚠️  Found 1 stopped EC2 instances. Consider terminating if not needed.
🔍 Review 2 running EC2 instances for optimization opportunities.
🗄️  Review 1 RDS instances for storage and performance optimization.
📦 Review 5 S3 buckets for lifecycle policies and cost optimization.
🎯 Focus optimization efforts on Amazon EC2 ($45.67)
```

## 🛠️ Requirements

### **System Requirements**
- Python 3.7+
- AWS CLI v2
- Internet connection

### **Python Dependencies**
- `boto3`: AWS SDK for Python
- `tabulate`: Pretty table formatting

### **AWS Permissions**
The script requires the following AWS permissions:
- `ec2:DescribeInstances`
- `rds:DescribeDBInstances`
- `s3:ListAllMyBuckets`
- `ecs:ListServices`
- `elasticloadbalancing:DescribeLoadBalancers`
- `lambda:ListFunctions`
- `elasticache:DescribeCacheClusters`
- `cloudfront:ListDistributions`
- `ce:GetCostAndUsage`

## 🔧 Configuration

### **AWS CLI Setup**
```bash
# Configure AWS CLI
aws configure

# Enter your:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region (e.g., us-east-1)
# - Default output format (json)
```

### **Environment Variables**
```bash
# Optional: Set AWS region
export AWS_DEFAULT_REGION=us-east-1

# Optional: Set AWS profile
export AWS_PROFILE=my-profile
```

## 🚨 Troubleshooting

### **Common Issues**

1. **Permission Denied**
   ```
   Error: User is not authorized to perform: ec2:DescribeInstances
   ```
   **Solution**: Ensure your AWS credentials have the required permissions.

2. **AWS CLI Not Configured**
   ```
   Error: Unable to locate credentials
   ```
   **Solution**: Run `aws configure` to set up credentials.

3. **Cost Explorer Access Denied**
   ```
   Error getting cost data: An error occurred (AccessDeniedException)
   ```
   **Solution**: Ensure you have `ce:GetCostAndUsage` permission.

4. **Region-Specific Resources**
   ```
   Error: The specified bucket does not exist
   ```
   **Solution**: Some resources are global, others are region-specific. Check the region parameter.

### **Debug Mode**
```bash
# Run with verbose output
python3 aws_cost_analysis.py --detailed 2>&1 | tee aws_analysis.log
```

## 📈 Advanced Usage

### **Custom Time Period**
Edit the script to change the cost analysis period:
```python
# In the get_cost_data method, change days=30 to your desired period
analyzer.get_cost_data(days=90)  # Last 90 days
```

### **Multiple Regions**
```bash
# Analyze multiple regions
for region in us-east-1 us-west-2 eu-west-1; do
    echo "Analyzing $region..."
    python3 aws_cost_analysis.py --region $region
done
```

### **Export to JSON**
```bash
# Save output to file
python3 aws_cost_analysis.py --detailed > aws_analysis_report.txt
```

## 🔒 Security Notes

- The script only **reads** AWS resources, it doesn't modify anything
- All AWS CLI commands use read-only permissions
- No sensitive data is stored locally
- Credentials are handled by AWS CLI configuration

## 📚 Related Documentation

- **[AWS CLI Documentation](https://docs.aws.amazon.com/cli/)**
- **[AWS Cost Explorer](https://docs.aws.amazon.com/cost-management/latest/userguide/)**
- **[AWS Boto3 Documentation](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html)**

---

*"The first step is to establish that something is possible; then probability will occur." - Elon Musk*
