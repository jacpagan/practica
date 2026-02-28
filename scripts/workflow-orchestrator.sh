#!/bin/bash

# Advanced Workflow Orchestrator
# Enhanced dev-to-staging-to-prod workflow with advanced features

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_ROOT/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/workflow_$TIMESTAMP.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Create logs directory
mkdir -p "$LOG_DIR"

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $1${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ❌ $1${NC}" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${CYAN}[$(date '+%Y-%m-%d %H:%M:%S')] ℹ️  $1${NC}" | tee -a "$LOG_FILE"
}

# Pre-flight checks
preflight_check() {
    log "🔍 Running pre-flight checks..."
    
    # Check Docker
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "docker-compose is not installed"
        exit 1
    fi
    
    # Check Git status
    if ! git status > /dev/null 2>&1; then
        log_warning "Not in a git repository"
    else
        # Check for uncommitted changes
        if ! git diff-index --quiet HEAD --; then
            log_warning "You have uncommitted changes"
            read -p "Continue anyway? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log "Deployment cancelled"
                exit 1
            fi
        fi
        
        # Check if on main branch
        current_branch=$(git branch --show-current)
        if [ "$current_branch" != "main" ]; then
            log_warning "You're not on the main branch (current: $current_branch)"
            read -p "Continue anyway? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log "Deployment cancelled"
                exit 1
            fi
        fi
    fi
    
    log_success "Pre-flight checks passed"
}

# Environment validation
validate_environment() {
    local env=$1
    log "🔍 Validating $env environment..."
    
    local env_file=".env.$env"
    if [ ! -f "$env_file" ]; then
        log_error "Environment file $env_file not found"
        return 1
    fi
    
    # Load environment variables
    export $(cat "$env_file" | grep -v '^#' | xargs)
    
    # Validate required variables
    local required_vars=("SECRET_KEY" "POSTGRES_PASSWORD")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "Required environment variable $var is not set in $env_file"
            return 1
        fi
    done
    
    log_success "$env environment validated"
    return 0
}

# Health check with retry
health_check() {
    local url=$1
    local max_attempts=${2:-30}
    local service_name=${3:-"service"}
    
    log "🏥 Checking $service_name health at $url..."
    
    for i in $(seq 1 $max_attempts); do
        if curl -f -s "$url" > /dev/null 2>&1; then
            log_success "$service_name is healthy"
            return 0
        fi
        
        if [ $i -eq $max_attempts ]; then
            log_error "$service_name health check failed after $max_attempts attempts"
            return 1
        fi
        
        sleep 2
    done
}

# Database backup
backup_database() {
    local env=$1
    local compose_file="docker-compose.$env.yml"
    
    log "💾 Creating database backup for $env..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$LOG_DIR/backup_${env}_${timestamp}.sql"
    
    if docker-compose -f "$compose_file" ps | grep -q "practica_db_1"; then
        docker-compose -f "$compose_file" exec -T db pg_dump -U practica practica_$env > "$backup_file"
        log_success "Database backup created: $backup_file"
    else
        log_info "No existing database found, skipping backup"
    fi
}

# Run tests with coverage
run_tests() {
    local env=$1
    local compose_file="docker-compose.$env.yml"
    
    log "🧪 Running tests for $env environment..."
    
    # Run backend tests
    docker-compose -f "$compose_file" exec -T backend python manage.py test --verbosity=1 --failfast
    
    # Run frontend tests if available
    if docker-compose -f "$compose_file" exec -T frontend npm test -- --passWithNoTests 2>/dev/null; then
        log_success "Frontend tests passed"
    else
        log_warning "Frontend tests not available or failed"
    fi
    
    log_success "Tests completed for $env"
}

# Deploy environment
deploy_environment() {
    local env=$1
    local compose_file="docker-compose.$env.yml"
    
    log "🚀 Deploying to $env environment..."
    
    # Validate environment
    if ! validate_environment "$env"; then
        log_error "Environment validation failed for $env"
        return 1
    fi
    
    # Create backup if not development
    if [ "$env" != "development" ]; then
        backup_database "$env"
    fi
    
    # Stop existing containers
    log "🛑 Stopping existing $env containers..."
    docker-compose -f "$compose_file" down 2>/dev/null || true
    
    # Build and start
    log "🐳 Building and starting $env environment..."
    docker-compose -f "$compose_file" up --build -d
    
    # Wait for services
    log "⏳ Waiting for services to start..."
    sleep 20
    
    # Health check
    local port="8000"
    if [ "$env" = "staging" ]; then
        port="8001"
    fi
    
    if ! health_check "http://localhost:$port/admin/" 30 "$env backend"; then
        log_error "$env deployment failed"
        docker-compose -f "$compose_file" logs backend
        return 1
    fi
    
    # Run migrations
    log "📊 Running database migrations..."
    docker-compose -f "$compose_file" exec -T backend python manage.py migrate
    
    # Collect static files
    log "📁 Collecting static files..."
    docker-compose -f "$compose_file" exec -T backend python manage.py collectstatic --noinput
    
    # Run tests
    run_tests "$env"
    
    log_success "$env deployment completed successfully"
    return 0
}

# Full workflow: dev -> staging -> prod
full_workflow() {
    log "🚀 Starting full workflow: dev -> staging -> prod"
    
    # Pre-flight checks
    preflight_check
    
    # Deploy to development
    log_info "Phase 1: Development Environment"
    if ! deploy_environment "development"; then
        log_error "Development deployment failed"
        exit 1
    fi
    
    # Deploy to staging
    log_info "Phase 2: Staging Environment"
    if ! deploy_environment "staging"; then
        log_error "Staging deployment failed"
        exit 1
    fi
    
    # Production confirmation
    log_warning "Phase 3: Production Environment"
    echo -e "${RED}⚠️  WARNING: This will deploy to PRODUCTION!${NC}"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Production deployment cancelled"
        exit 0
    fi
    
    # Deploy to production
    if ! deploy_environment "production"; then
        log_error "Production deployment failed"
        exit 1
    fi
    
    log_success "Full workflow completed successfully!"
    log_info "Log file: $LOG_FILE"
}

# Quick development workflow
dev_workflow() {
    log "🚀 Starting development workflow"
    
    preflight_check
    deploy_environment "development"
    
    log_success "Development workflow completed!"
    log_info "Log file: $LOG_FILE"
}

# Staging workflow
staging_workflow() {
    log "🚀 Starting staging workflow"
    
    preflight_check
    deploy_environment "staging"
    
    log_success "Staging workflow completed!"
    log_info "Log file: $LOG_FILE"
}

# Production workflow
prod_workflow() {
    log "🚀 Starting production workflow"
    
    preflight_check
    
    # Production confirmation
    echo -e "${RED}⚠️  WARNING: This will deploy to PRODUCTION!${NC}"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Production deployment cancelled"
        exit 0
    fi
    
    deploy_environment "production"
    
    log_success "Production workflow completed!"
    log_info "Log file: $LOG_FILE"
}

# Rollback function
rollback() {
    local env=$1
    local compose_file="docker-compose.$env.yml"
    
    log "🔄 Rolling back $env environment..."
    
    # Stop current containers
    docker-compose -f "$compose_file" down
    
    # Find latest backup
    local latest_backup=$(ls -t "$LOG_DIR"/backup_${env}_*.sql 2>/dev/null | head -n1)
    
    if [ -n "$latest_backup" ]; then
        log_info "Restoring from backup: $latest_backup"
        docker-compose -f "$compose_file" up -d db
        sleep 10
        docker-compose -f "$compose_file" exec -T db psql -U practica -d practica_$env < "$latest_backup"
        docker-compose -f "$compose_file" up -d
        log_success "Rollback completed"
    else
        log_error "No backup found for rollback"
        exit 1
    fi
}

# Status check
status_check() {
    log "📊 Checking all environments status..."
    
    local environments=("development" "staging" "production")
    
    for env in "${environments[@]}"; do
        local compose_file="docker-compose.$env.yml"
        local port="8000"
        
        if [ "$env" = "staging" ]; then
            port="8001"
        fi
        
        log_info "Checking $env environment..."
        
        if docker-compose -f "$compose_file" ps | grep -q "Up"; then
            if health_check "http://localhost:$port/admin/" 5 "$env"; then
                log_success "$env is running and healthy"
            else
                log_warning "$env is running but unhealthy"
            fi
        else
            log_warning "$env is not running"
        fi
    done
}

# Cleanup function
cleanup() {
    log "🧹 Cleaning up old logs and backups..."
    
    # Keep only last 10 log files
    ls -t "$LOG_DIR"/workflow_*.log 2>/dev/null | tail -n +11 | xargs rm -f
    
    # Keep only last 5 backups per environment
    for env in "staging" "production"; do
        ls -t "$LOG_DIR"/backup_${env}_*.sql 2>/dev/null | tail -n +6 | xargs rm -f
    done
    
    log_success "Cleanup completed"
}

# Main function
main() {
    case "${1:-help}" in
        "dev")
            dev_workflow
            ;;
        "staging")
            staging_workflow
            ;;
        "prod")
            prod_workflow
            ;;
        "full")
            full_workflow
            ;;
        "rollback")
            rollback "${2:-staging}"
            ;;
        "status")
            status_check
            ;;
        "cleanup")
            cleanup
            ;;
        "help"|*)
            echo "🚀 Advanced Workflow Orchestrator"
            echo ""
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  dev       - Deploy to development environment"
            echo "  staging   - Deploy to staging environment"
            echo "  prod      - Deploy to production environment"
            echo "  full      - Full workflow: dev -> staging -> prod"
            echo "  rollback  - Rollback environment (default: staging)"
            echo "  status    - Check status of all environments"
            echo "  cleanup   - Clean up old logs and backups"
            echo "  help      - Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 dev                    # Deploy to development"
            echo "  $0 staging                # Deploy to staging"
            echo "  $0 prod                   # Deploy to production"
            echo "  $0 full                   # Full workflow"
            echo "  $0 rollback staging       # Rollback staging"
            echo "  $0 status                 # Check all environments"
            echo ""
            ;;
    esac
}

# Run main function with all arguments
main "$@"
