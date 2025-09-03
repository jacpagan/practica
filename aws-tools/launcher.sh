#!/bin/bash
# AWS Tools Launcher Script
# Quick access to all AWS management tools

echo "🚀 AWS Tools Launcher"
echo "===================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_option() {
    echo -e "${BLUE}$1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Available tools:"
echo ""
print_option "1. 📊 Analyze AWS Resources & Costs"
print_option "2. 🧹 Clean Up Unused Resources"
print_option "3. ⚙️  Setup Environment"
print_option "4. 📋 Show Current Resources"
print_option "5. 💰 Show Cost Analysis"
print_option "6. 📚 View Documentation"
print_option "7. 🚪 Exit"
echo ""

read -p "Select an option (1-7): " choice

case $choice in
    1)
        echo ""
        echo "📊 AWS Resource Analysis"
        echo "======================="
        echo ""
        echo "Options:"
        echo "1. Basic analysis"
        echo "2. Detailed analysis"
        echo "3. Different region"
        echo ""
        read -p "Select analysis type (1-3): " analysis_type
        
        case $analysis_type in
            1)
                python3 "$SCRIPT_DIR/scripts/aws_cost_analysis.py"
                ;;
            2)
                python3 "$SCRIPT_DIR/scripts/aws_cost_analysis.py" --detailed
                ;;
            3)
                read -p "Enter region (e.g., us-west-2): " region
                python3 "$SCRIPT_DIR/scripts/aws_cost_analysis.py" --region "$region"
                ;;
            *)
                print_warning "Invalid option. Running basic analysis..."
                python3 "$SCRIPT_DIR/scripts/aws_cost_analysis.py"
                ;;
        esac
        ;;
    2)
        echo ""
        echo "🧹 Resource Cleanup"
        echo "==================="
        echo ""
        print_warning "This will remove unused S3 buckets and CloudFront distributions."
        read -p "Continue? (y/N): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            "$SCRIPT_DIR/scripts/cleanup_unused_resources.sh"
        else
            print_warning "Cleanup cancelled."
        fi
        ;;
    3)
        echo ""
        echo "⚙️  Environment Setup"
        echo "===================="
        echo ""
        "$SCRIPT_DIR/scripts/setup_aws_analysis.sh"
        ;;
    4)
        echo ""
        echo "📋 Current Resources"
        echo "==================="
        echo ""
        python3 "$SCRIPT_DIR/scripts/aws_cost_analysis.py" | grep -A 20 "RESOURCE SUMMARY"
        ;;
    5)
        echo ""
        echo "💰 Cost Analysis"
        echo "==============="
        echo ""
        python3 "$SCRIPT_DIR/scripts/aws_cost_analysis.py" | grep -A 20 "COST SUMMARY"
        ;;
    6)
        echo ""
        echo "📚 Documentation"
        echo "================"
        echo ""
        echo "Available documentation:"
        echo "1. Main README: $SCRIPT_DIR/README.md"
        echo "2. Detailed Guide: $SCRIPT_DIR/docs/AWS_ANALYSIS_README.md"
        echo "3. Scripts Directory: $SCRIPT_DIR/scripts/"
        echo ""
        echo "You can view these files with:"
        echo "cat $SCRIPT_DIR/README.md"
        echo "cat $SCRIPT_DIR/docs/AWS_ANALYSIS_README.md"
        echo "ls -la $SCRIPT_DIR/scripts/"
        ;;
    7)
        print_success "Goodbye!"
        exit 0
        ;;
    *)
        print_warning "Invalid option. Please select 1-7."
        ;;
esac

echo ""
print_success "Operation completed!"
echo ""
echo "To run this launcher again:"
echo "cd aws-tools && ./launcher.sh"
