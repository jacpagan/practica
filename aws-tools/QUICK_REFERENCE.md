# AWS Tools Quick Reference

## 🚀 Quick Access

```bash
# Interactive launcher (recommended)
cd aws-tools && ./launcher.sh

# Direct script access
cd aws-tools/scripts
python3 aws_cost_analysis.py --detailed
./cleanup_unused_resources.sh
```

## 📁 Organized Structure

```
aws-tools/
├── 📄 README.md                    # Main overview & documentation
├── 📄 launcher.sh                  # Interactive menu launcher
├── 📄 requirements.txt             # Python dependencies
├── 📁 scripts/                     # All executable scripts
│   ├── 📄 aws_cost_analysis.py     # Resource discovery & cost analysis
│   ├── 📄 cleanup_unused_resources.sh # Safe resource cleanup
│   └── 📄 setup_aws_analysis.sh    # Environment setup
└── 📁 docs/                        # Detailed documentation
    └── 📄 AWS_ANALYSIS_README.md   # Comprehensive usage guide
```

## 🎯 Common Commands

### **Analysis**
```bash
# Basic resource analysis
python3 aws-tools/scripts/aws_cost_analysis.py

# Detailed analysis with resource details
python3 aws-tools/scripts/aws_cost_analysis.py --detailed

# Different region
python3 aws-tools/scripts/aws_cost_analysis.py --region us-west-2
```

### **Cleanup**
```bash
# Remove unused resources (with confirmation)
./aws-tools/scripts/cleanup_unused_resources.sh
```

### **Setup**
```bash
# Install dependencies and verify AWS config
./aws-tools/scripts/setup_aws_analysis.sh
```

## 📊 What You Get

- **Resource Discovery**: All AWS services and resources
- **Cost Analysis**: Monthly costs by service
- **Optimization Tips**: Cost-saving recommendations
- **Safe Cleanup**: Remove unused resources
- **Interactive Menu**: Easy-to-use launcher

## 🔒 Safety Features

- ✅ Read-only discovery operations
- ✅ Confirmation required for cleanup
- ✅ Error handling and rollback
- ✅ Clear warnings before destructive operations

---

*Organized for efficiency, designed for safety.*
