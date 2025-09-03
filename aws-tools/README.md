# AWS Tools & Infrastructure Management

This directory contains comprehensive AWS resource management tools and documentation for the Practika platform.

## 📁 Directory Structure

```
aws-tools/
├── 📄 README.md                    # This file - Main overview
├── 📄 requirements.txt             # Python dependencies
├── 📁 scripts/                     # Executable scripts
│   ├── 📄 aws_cost_analysis.py     # Resource discovery & cost analysis
│   ├── 📄 cleanup_unused_resources.sh # Remove unused AWS resources
│   └── 📄 setup_aws_analysis.sh    # Setup script for dependencies
└── 📁 docs/                        # Documentation
    └── 📄 AWS_ANALYSIS_README.md   # Detailed usage guide
```

## 🚀 Quick Start

### **1. Setup Environment**
```bash
cd aws-tools
./scripts/setup_aws_analysis.sh
```

### **2. Analyze Your AWS Resources**
```bash
# Basic analysis
python3 scripts/aws_cost_analysis.py

# Detailed analysis
python3 scripts/aws_cost_analysis.py --detailed

# Different region
python3 scripts/aws_cost_analysis.py --region us-west-2
```

### **3. Clean Up Unused Resources**
```bash
# Remove unused S3 buckets and CloudFront distributions
./scripts/cleanup_unused_resources.sh
```

## 🛠️ Available Tools

### **📊 AWS Cost Analysis Script**
- **Purpose**: Discover all AWS resources and analyze costs
- **Features**: 
  - Resource discovery across all major AWS services
  - Cost breakdown by service
  - Optimization recommendations
  - Detailed resource information
- **Usage**: `python3 scripts/aws_cost_analysis.py [--detailed] [--region REGION]`

### **🧹 Resource Cleanup Script**
- **Purpose**: Remove unused AWS resources safely
- **Features**:
  - Identifies duplicate/unused resources
  - Safe removal with confirmation
  - Proper cleanup order (CloudFront → S3)
  - Error handling and rollback
- **Usage**: `./scripts/cleanup_unused_resources.sh`

### **⚙️ Setup Script**
- **Purpose**: Install dependencies and verify AWS configuration
- **Features**:
  - Python dependency installation
  - AWS CLI verification
  - Permission checks
  - Usage instructions
- **Usage**: `./scripts/setup_aws_analysis.sh`

## 📋 What These Tools Discover

### **Compute Resources**
- EC2 instances (running, stopped, terminated)
- ECS services and clusters
- Lambda functions
- Load balancers (ALB, NLB, CLB)

### **Storage Resources**
- S3 buckets and their contents
- EBS volumes and snapshots
- RDS database instances
- ElastiCache clusters

### **Networking Resources**
- VPCs and subnets
- Security groups
- CloudFront distributions
- Route 53 hosted zones

### **Cost Analysis**
- Monthly costs by service
- Cost trends over time
- Optimization recommendations
- Resource utilization

## 🎯 Use Cases

### **For Developers**
- Understand current infrastructure
- Identify unused resources
- Optimize costs
- Plan scaling strategies

### **For DevOps Engineers**
- Infrastructure auditing
- Cost optimization
- Resource cleanup
- Security review

### **For Business Stakeholders**
- Cost analysis and budgeting
- Resource utilization reports
- Optimization opportunities
- Infrastructure overview

## 🔒 Security & Safety

### **Read-Only Operations**
- All discovery operations are read-only
- No resources are modified during analysis
- Safe to run on production environments

### **Confirmation Required**
- Cleanup operations require explicit confirmation
- Step-by-step process with rollback options
- Clear warnings before destructive operations

### **Permission Requirements**
- `ec2:DescribeInstances`
- `rds:DescribeDBInstances`
- `s3:ListAllMyBuckets`
- `cloudfront:ListDistributions`
- `ce:GetCostAndUsage`
- And other read permissions

## 📊 Sample Output

```
🚀 AWS RESOURCE DISCOVERY & COST ANALYSIS REPORT
================================================================================
Region: us-east-1
Generated: 2025-09-03 08:33:15
================================================================================

📊 RESOURCE SUMMARY
----------------------------------------
| Service       | Count |
|================|=======|
| EC2           |     0 |
| RDS           |     1 |
| ECS           |     1 |
| LoadBalancer  |     1 |
| S3            |     3 |
| CloudFront    |     2 |
| VPC           |     1 |
| SecurityGroup |     7 |
----------------------------------------

💰 COST SUMMARY (Last 30 Days)
----------------------------------------
| Service                                | Cost   |
|========================================|========|
| Amazon Registrar                       | $30.00 |
| Amazon Virtual Private Cloud           | $2.51  |
| Amazon Elastic Load Balancing          | $2.41  |
| Amazon Relational Database Service     | $1.83  |
| TOTAL                                  | $42.37 |
----------------------------------------
```

## 🔧 Configuration

### **AWS CLI Setup**
```bash
# Configure AWS CLI
aws configure

# Enter your credentials and region
```

### **Environment Variables**
```bash
# Optional: Set default region
export AWS_DEFAULT_REGION=us-east-1

# Optional: Use specific profile
export AWS_PROFILE=my-profile
```

## 🚨 Troubleshooting

### **Common Issues**

1. **Permission Denied**
   ```bash
   # Ensure your AWS credentials have required permissions
   aws sts get-caller-identity
   ```

2. **Python Dependencies**
   ```bash
   # Install required packages
   pip3 install -r requirements.txt
   ```

3. **AWS CLI Not Found**
   ```bash
   # Install AWS CLI
   curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
   sudo installer -pkg AWSCLIV2.pkg -target /
   ```

### **Debug Mode**
```bash
# Run with verbose output
python3 scripts/aws_cost_analysis.py --detailed 2>&1 | tee aws_analysis.log
```

## 📈 Advanced Usage

### **Custom Analysis**
```bash
# Analyze multiple regions
for region in us-east-1 us-west-2 eu-west-1; do
    echo "Analyzing $region..."
    python3 scripts/aws_cost_analysis.py --region $region
done
```

### **Automated Cleanup**
```bash
# Create a scheduled cleanup (be careful!)
# Add to crontab for regular cleanup
0 2 * * 0 /path/to/aws-tools/scripts/cleanup_unused_resources.sh
```

### **Integration with CI/CD**
```bash
# Add to your deployment pipeline
python3 scripts/aws_cost_analysis.py --region us-east-1 > cost_report.txt
```

## 📚 Related Documentation

- **[Detailed Usage Guide](docs/AWS_ANALYSIS_README.md)** - Comprehensive documentation
- **[AWS CLI Documentation](https://docs.aws.amazon.com/cli/)** - Official AWS CLI docs
- **[AWS Cost Explorer](https://docs.aws.amazon.com/cost-management/)** - Cost management
- **[AWS Boto3 Documentation](https://boto3.amazonaws.com/)** - Python SDK docs

## 🤝 Contributing

### **Adding New Tools**
1. Place scripts in the `scripts/` directory
2. Update this README with usage instructions
3. Add any dependencies to `requirements.txt`
4. Test thoroughly before committing

### **Improving Documentation**
1. Update relevant documentation files
2. Include examples and use cases
3. Add troubleshooting sections
4. Keep information current

---

*"The best way to predict the future is to invent it." - Alan Kay*

*"The first step is to establish that something is possible; then probability will occur." - Elon Musk*
