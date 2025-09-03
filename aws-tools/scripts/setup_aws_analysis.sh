#!/bin/bash
# AWS Cost Analysis Setup Script

echo "🚀 Setting up AWS Cost Analysis Script..."

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed. Please install Python 3 first."
    exit 1
fi

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is required but not installed. Please install pip3 first."
    exit 1
fi

# Install required packages
echo "📦 Installing required Python packages..."
pip3 install -r requirements.txt

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "⚠️  AWS CLI is not installed. Please install AWS CLI first:"
    echo "   https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    echo ""
    echo "After installing AWS CLI, configure it with:"
    echo "   aws configure"
    exit 1
fi

# Check AWS CLI configuration
echo "🔍 Checking AWS CLI configuration..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI is not configured or credentials are invalid."
    echo "Please run: aws configure"
    exit 1
fi

echo "✅ Setup complete!"
echo ""
echo "Usage:"
echo "  python3 aws_cost_analysis.py                    # Basic analysis"
echo "  python3 aws_cost_analysis.py --detailed         # Detailed analysis"
echo "  python3 aws_cost_analysis.py --region us-west-2 # Different region"
echo ""
echo "The script will discover all your AWS resources and provide cost analysis."
