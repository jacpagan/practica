#!/bin/bash

# AWS Migration and Deployment Script for Practika Django App
# This script deploys your app to AWS with full security and HTTPS support

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="practika"
AWS_REGION="us-east-1"
ECR_REPOSITORY_NAME="${PROJECT_NAME}"
CLUSTER_NAME="${PROJECT_NAME}-prod"
SERVICE_NAME="${PROJECT_NAME}-service"
TASK_FAMILY="${PROJECT_NAME}-task"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check AWS CLI configuration
check_aws_cli() {
    if ! command_exists aws; then
        print_error "AWS CLI is not installed. Please install it first."
        print_status "Installation guide: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
        exit 1
    fi

    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        print_error "AWS CLI is not configured. Please run 'aws configure' first."
        exit 1
    fi

    print_success "AWS CLI is configured and working"
}

# Function to check Docker
check_docker() {
    if ! command_exists docker; then
        print_error "Docker is not installed. Please install it first."
        exit 1
    fi

    if ! docker info >/dev/null 2>&1; then
        print_error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi

    print_success "Docker is running"
}

# Function to create ECR repository
create_ecr_repository() {
    print_status "Creating ECR repository: ${ECR_REPOSITORY_NAME}"
    
    if aws ecr describe-repositories --repository-names "${ECR_REPOSITORY_NAME}" --region "${AWS_REGION}" >/dev/null 2>&1; then
        print_warning "ECR repository ${ECR_REPOSITORY_NAME} already exists"
    else
        aws ecr create-repository \
            --repository-name "${ECR_REPOSITORY_NAME}" \
            --region "${AWS_REGION}" \
            --image-scanning-configuration scanOnPush=true \
            --encryption-configuration encryptionType=AES256
        
        print_success "ECR repository created"
    fi
}

# Function to get ECR login token
get_ecr_login_token() {
    print_status "Getting ECR login token"
    
    ECR_LOGIN_TOKEN=$(aws ecr get-login-password --region "${AWS_REGION}")
    ECR_REGISTRY=$(aws ecr describe-repositories --repository-names "${ECR_REPOSITORY_NAME}" --region "${AWS_REGION}" --query 'repositories[0].repositoryUri' --output text)
    
    print_success "ECR registry: ${ECR_REGISTRY}"
}

# Function to build and push Docker image
build_and_push_image() {
    print_status "Building Docker image for AWS"
    
    # Build image with AWS-optimized Dockerfile
    docker build -f Dockerfile.aws -t "${ECR_REGISTRY}:latest" .
    
    print_status "Logging into ECR"
    echo "${ECR_LOGIN_TOKEN}" | docker login --username AWS --password-stdin "${ECR_REGISTRY}"
    
    print_status "Pushing image to ECR"
    docker push "${ECR_REGISTRY}:latest"
    
    print_success "Docker image pushed to ECR"
}

# Function to create AWS Secrets Manager secret
create_secrets() {
    print_status "Creating secrets in AWS Secrets Manager"
    
    # Generate Django secret key if not provided
    if [ -z "${DJANGO_SECRET_KEY}" ]; then
        DJANGO_SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')
        print_warning "Generated new Django secret key"
    fi
    
    # Create secret for Django
    if aws secretsmanager describe-secret --secret-id "practika-secret-key" --region "${AWS_REGION}" >/dev/null 2>&1; then
        print_warning "Secret practika-secret-key already exists, updating..."
        aws secretsmanager update-secret \
            --secret-id "practika-secret-key" \
            --secret-string "{\"secret-key\":\"${DJANGO_SECRET_KEY}\"}" \
            --region "${AWS_REGION}"
    else
        aws secretsmanager create-secret \
            --name "practika-secret-key" \
            --description "Django secret key for Practika app" \
            --secret-string "{\"secret-key\":\"${DJANGO_SECRET_KEY}\"}" \
            --region "${AWS_REGION}"
    fi
    
    print_success "Secrets created/updated"
}

# Function to deploy CloudFormation stack
deploy_cloudformation() {
    print_status "Deploying CloudFormation stack"
    
    STACK_NAME="${PROJECT_NAME}-infrastructure"
    
    # Check if stack exists
    if aws cloudformation describe-stacks --stack-name "${STACK_NAME}" --region "${AWS_REGION}" >/dev/null 2>&1; then
        print_status "Stack ${STACK_NAME} exists, updating..."
        aws cloudformation update-stack \
            --stack-name "${STACK_NAME}" \
            --template-body file://aws-deployment.yml \
            --parameters \
                ParameterKey=EnvironmentName,ParameterValue="${PROJECT_NAME}-prod" \
                ParameterKey=DBUsername,ParameterValue="${DB_USERNAME:-practika_admin}" \
                ParameterKey=DBPassword,ParameterValue="${DB_PASSWORD}" \
            --capabilities CAPABILITY_NAMED_IAM \
            --region "${AWS_REGION}"
        
        print_status "Waiting for stack update to complete..."
        aws cloudformation wait stack-update-complete --stack-name "${STACK_NAME}" --region "${AWS_REGION}"
    else
        print_status "Creating new stack ${STACK_NAME}..."
        aws cloudformation create-stack \
            --stack-name "${STACK_NAME}" \
            --template-body file://aws-deployment.yml \
            --parameters \
                ParameterKey=EnvironmentName,ParameterValue="${PROJECT_NAME}-prod" \
                ParameterKey=DBUsername,ParameterValue="${DB_USERNAME:-practika_admin}" \
                ParameterKey=DBPassword,ParameterValue="${DB_PASSWORD}" \
            --capabilities CAPABILITY_NAMED_IAM \
            --region "${AWS_REGION}"
        
        print_status "Waiting for stack creation to complete..."
        aws cloudformation wait stack-create-complete --stack-name "${STACK_NAME}" --region "${AWS_REGION}"
    fi
    
    print_success "CloudFormation stack deployed successfully"
}

# Function to get stack outputs
get_stack_outputs() {
    print_status "Getting stack outputs"
    
    STACK_NAME="${PROJECT_NAME}-infrastructure"
    
    # Get load balancer DNS
    ALB_DNS=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${AWS_REGION}" \
        --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
        --output text)
    
    # Get database endpoint
    DB_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${AWS_REGION}" \
        --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' \
        --output text)
    
    # Get S3 bucket name
    S3_BUCKET=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${AWS_REGION}" \
        --query 'Stacks[0].Outputs[?OutputKey==`MediaBucketName`].OutputValue' \
        --output text)
    
    print_success "Stack outputs retrieved:"
    echo "  Load Balancer DNS: ${ALB_DNS}"
    echo "  Database Endpoint: ${DB_ENDPOINT}"
    echo "  S3 Bucket: ${S3_BUCKET}"
}

# Function to update ECS service
update_ecs_service() {
    print_status "Updating ECS service with new image"
    
    # Get current task definition
    CURRENT_TASK_DEF=$(aws ecs describe-services \
        --cluster "${CLUSTER_NAME}" \
        --services "${SERVICE_NAME}" \
        --region "${AWS_REGION}" \
        --query 'services[0].taskDefinition' \
        --output text)
    
    # Create new task definition revision
    NEW_TASK_DEF=$(aws ecs register-task-definition \
        --family "${TASK_FAMILY}" \
        --task-role-arn "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/practika-prod-task" \
        --execution-role-arn "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/practika-prod-task-execution" \
        --network-mode awsvpc \
        --requires-compatibilities FARGATE \
        --cpu 256 \
        --memory 512 \
        --container-definitions "[{\"name\":\"practika-web\",\"image\":\"${ECR_REGISTRY}:latest\",\"portMappings\":[{\"containerPort\":8000,\"protocol\":\"tcp\"}],\"environment\":[{\"name\":\"DJANGO_ENVIRONMENT\",\"value\":\"production\"},{\"name\":\"DJANGO_DEBUG\",\"value\":\"False\"},{\"name\":\"USE_S3\",\"value\":\"True\"},{\"name\":\"AWS_STORAGE_BUCKET_NAME\",\"value\":\"${S3_BUCKET}\"},{\"name\":\"AWS_S3_REGION_NAME\",\"value\":\"${AWS_REGION}\"}],\"logConfiguration\":{\"logDriver\":\"awslogs\",\"options\":{\"awslogs-group\":\"/ecs/${CLUSTER_NAME}\",\"awslogs-region\":\"${AWS_REGION}\",\"awslogs-stream-prefix\":\"practika\"}}}]" \
        --region "${AWS_REGION}" \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text)
    
    # Update service with new task definition
    aws ecs update-service \
        --cluster "${CLUSTER_NAME}" \
        --service "${SERVICE_NAME}" \
        --task-definition "${NEW_TASK_DEF}" \
        --region "${AWS_REGION}"
    
    print_success "ECS service updated with new task definition"
}

# Function to wait for service stability
wait_for_service_stability() {
    print_status "Waiting for ECS service to become stable..."
    
    aws ecs wait services-stable \
        --cluster "${CLUSTER_NAME}" \
        --services "${SERVICE_NAME}" \
        --region "${AWS_REGION}"
    
    print_success "ECS service is now stable"
}

# Function to run database migrations
run_migrations() {
    print_status "Running database migrations"
    
    # Get task definition ARN
    TASK_DEF_ARN=$(aws ecs describe-services \
        --cluster "${CLUSTER_NAME}" \
        --services "${SERVICE_NAME}" \
        --region "${AWS_REGION}" \
        --query 'services[0].taskDefinition' \
        --output text)
    
    # Run migration task
    aws ecs run-task \
        --cluster "${CLUSTER_NAME}" \
        --task-definition "${TASK_DEF_ARN}" \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[$(aws ecs describe-services --cluster "${CLUSTER_NAME}" --services "${SERVICE_NAME}" --region "${AWS_REGION}" --query 'services[0].networkConfiguration.awsvpcConfiguration.subnets[]' --output text | tr '\t' ',')],securityGroups=[$(aws ecs describe-services --cluster "${CLUSTER_NAME}" --services "${SERVICE_NAME}" --region "${AWS_REGION}" --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups[]' --output text | tr '\t' ',')],assignPublicIp=ENABLED}" \
        --overrides '{"containerOverrides":[{"name":"practika-web","command":["python","manage.py","migrate","--noinput"]}]}' \
        --region "${AWS_REGION}"
    
    print_success "Migration task started"
}

# Function to collect static files
collect_static() {
    print_status "Collecting static files"
    
    # Get task definition ARN
    TASK_DEF_ARN=$(aws ecs describe-services \
        --cluster "${CLUSTER_NAME}" \
        --services "${SERVICE_NAME}" \
        --region "${AWS_REGION}" \
        --query 'services[0].taskDefinition' \
        --output text)
    
    # Run collectstatic task
    aws ecs run-task \
        --cluster "${CLUSTER_NAME}" \
        --task-definition "${TASK_DEF_ARN}" \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[$(aws ecs describe-services --cluster "${CLUSTER_NAME}" --services "${SERVICE_NAME}" --region "${AWS_REGION}" --query 'services[0].networkConfiguration.awsvpcConfiguration.subnets[]' --output text | tr '\t' ',')],securityGroups=[$(aws ecs describe-services --cluster "${CLUSTER_NAME}" --services "${SERVICE_NAME}" --region "${AWS_REGION}" --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups[]' --output text | tr '\t' ',')],assignPublicIp=ENABLED}" \
        --overrides '{"containerOverrides":[{"name":"practika-web","command":["python","manage.py","collectstatic","--noinput"]}]}' \
        --region "${AWS_REGION}"
    
    print_success "Static files collection task started"
}

# Function to test the deployment
test_deployment() {
    print_status "Testing deployment"
    
    # Get load balancer DNS
    ALB_DNS=$(aws cloudformation describe-stacks \
        --stack-name "${PROJECT_NAME}-infrastructure" \
        --region "${AWS_REGION}" \
        --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
        --output text)
    
    # Wait a bit for the service to be fully ready
    sleep 30
    
    # Test health endpoint
    if curl -f "http://${ALB_DNS}/core/health/" >/dev/null 2>&1; then
        print_success "Health check passed! App is running at http://${ALB_DNS}"
    else
        print_error "Health check failed. Please check the logs."
        exit 1
    fi
}

# Function to display final information
display_final_info() {
    print_success "AWS migration completed successfully!"
    echo ""
    echo "Your Django app is now running on AWS with the following services:"
    echo "  - ECS Fargate for compute"
    echo "  - RDS PostgreSQL for database"
    echo "  - S3 for file storage"
    echo "  - Application Load Balancer for traffic distribution"
    echo "  - CloudWatch for monitoring and logging"
    echo ""
    echo "Next steps:"
    echo "  1. Set up a custom domain with Route 53"
    echo "  2. Configure SSL certificate with AWS Certificate Manager"
    echo "  3. Set up CloudFront CDN for better performance"
    echo "  4. Configure monitoring and alerting in CloudWatch"
    echo "  5. Set up backup and disaster recovery procedures"
    echo ""
    echo "Useful AWS CLI commands:"
    echo "  - View ECS service: aws ecs describe-services --cluster ${CLUSTER_NAME} --services ${SERVICE_NAME} --region ${AWS_REGION}"
    echo "  - View logs: aws logs describe-log-groups --log-group-name-prefix /ecs/${CLUSTER_NAME} --region ${AWS_REGION}"
    echo "  - Scale service: aws ecs update-service --cluster ${CLUSTER_NAME} --service ${SERVICE_NAME} --desired-count 3 --region ${AWS_REGION}"
}

# Main deployment function
main() {
    print_status "Starting AWS migration for Practika Django app"
    
    # Check prerequisites
    check_aws_cli
    check_docker
    
    # Set required environment variables
    if [ -z "${DB_PASSWORD}" ]; then
        print_error "DB_PASSWORD environment variable is required"
        print_status "Please set it: export DB_PASSWORD='your-secure-password'"
        exit 1
    fi
    
    # Execute deployment steps
    create_ecr_repository
    get_ecr_login_token
    build_and_push_image
    create_secrets
    deploy_cloudformation
    get_stack_outputs
    update_ecs_service
    wait_for_service_stability
    run_migrations
    collect_static
    test_deployment
    display_final_info
}

# Check if script is being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

