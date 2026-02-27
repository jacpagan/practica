#!/bin/bash

# Advanced Monitoring & Alerting System
# Comprehensive monitoring for all environments

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MONITORING_DIR="$PROJECT_ROOT/monitoring"
LOG_DIR="$PROJECT_ROOT/logs"
ALERT_LOG="$LOG_DIR/alerts.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Create directories
mkdir -p "$MONITORING_DIR" "$LOG_DIR"

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_alert() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] 🚨 ALERT: $1${NC}" | tee -a "$ALERT_LOG"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

# Configuration
ENVIRONMENTS=("development" "staging" "production")
THRESHOLDS=(
    "CPU_USAGE=80"
    "MEMORY_USAGE=85"
    "DISK_USAGE=90"
    "RESPONSE_TIME=2000"
    "ERROR_RATE=5"
)

# Slack webhook (set in environment)
SLACK_WEBHOOK=${SLACK_WEBHOOK:-""}

# Send alert to Slack
send_slack_alert() {
    local message="$1"
    local severity="${2:-warning}"
    
    if [ -n "$SLACK_WEBHOOK" ]; then
        local color="good"
        case "$severity" in
            "critical") color="danger" ;;
            "warning") color="warning" ;;
            "info") color="good" ;;
        esac
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"attachments\":[{\"color\":\"$color\",\"text\":\"$message\"}]}" \
            "$SLACK_WEBHOOK" 2>/dev/null || true
    fi
}

# Check service health
check_service_health() {
    local env=$1
    local service=$2
    local url=$3
    
    log "Checking $env $service health..."
    
    local response_time
    response_time=$(curl -o /dev/null -s -w '%{time_total}' "$url" 2>/dev/null || echo "9999")
    response_time=$(echo "$response_time * 1000" | bc)
    
    local status_code
    status_code=$(curl -o /dev/null -s -w '%{http_code}' "$url" 2>/dev/null || echo "000")
    
    if [ "$status_code" = "200" ]; then
        log_success "$env $service is healthy (${response_time}ms)"
        
        # Check response time threshold
        if (( $(echo "$response_time > $RESPONSE_TIME" | bc -l) )); then
            log_alert "$env $service response time is slow: ${response_time}ms"
            send_slack_alert "⚠️ $env $service response time is slow: ${response_time}ms" "warning"
        fi
    else
        log_alert "$env $service is unhealthy (HTTP $status_code)"
        send_slack_alert "🚨 $env $service is down! HTTP $status_code" "critical"
        return 1
    fi
}

# Check container health
check_container_health() {
    local env=$1
    local compose_file="docker-compose.$env.yml"
    
    log "Checking $env container health..."
    
    if [ ! -f "$compose_file" ]; then
        log_alert "$env compose file not found"
        return 1
    fi
    
    # Check if containers are running
    local running_containers
    running_containers=$(docker-compose -f "$compose_file" ps -q | wc -l)
    
    if [ "$running_containers" -eq 0 ]; then
        log_alert "$env environment is not running"
        send_slack_alert "🚨 $env environment is not running!" "critical"
        return 1
    fi
    
    # Check container status
    local unhealthy_containers
    unhealthy_containers=$(docker-compose -f "$compose_file" ps | grep -c "unhealthy" || echo "0")
    
    if [ "$unhealthy_containers" -gt 0 ]; then
        log_alert "$env has $unhealthy_containers unhealthy containers"
        send_slack_alert "⚠️ $env has $unhealthy_containers unhealthy containers" "warning"
    fi
    
    log_success "$env containers are healthy"
}

# Check resource usage
check_resource_usage() {
    local env=$1
    local compose_file="docker-compose.$env.yml"
    
    log "Checking $env resource usage..."
    
    # Get container stats
    local stats
    stats=$(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" $(docker-compose -f "$compose_file" ps -q) 2>/dev/null || echo "")
    
    if [ -n "$stats" ]; then
        echo "$stats" | tail -n +2 | while read -r container cpu mem_usage mem_perc; do
            # Extract CPU percentage
            local cpu_perc=$(echo "$cpu" | sed 's/%//')
            
            # Extract memory percentage
            local mem_perc_num=$(echo "$mem_perc" | sed 's/%//')
            
            # Check CPU threshold
            if (( $(echo "$cpu_perc > $CPU_USAGE" | bc -l) )); then
                log_alert "$env container $container CPU usage is high: ${cpu_perc}%"
                send_slack_alert "⚠️ $env container $container CPU usage is high: ${cpu_perc}%" "warning"
            fi
            
            # Check memory threshold
            if (( $(echo "$mem_perc_num > $MEMORY_USAGE" | bc -l) )); then
                log_alert "$env container $container memory usage is high: ${mem_perc}"
                send_slack_alert "⚠️ $env container $container memory usage is high: ${mem_perc}" "warning"
            fi
        done
    fi
}

# Check disk usage
check_disk_usage() {
    local env=$1
    
    log "Checking $env disk usage..."
    
    local disk_usage
    disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ "$disk_usage" -gt "$DISK_USAGE" ]; then
        log_alert "$env disk usage is high: ${disk_usage}%"
        send_slack_alert "⚠️ $env disk usage is high: ${disk_usage}%" "warning"
    else
        log_success "$env disk usage is normal: ${disk_usage}%"
    fi
}

# Check database health
check_database_health() {
    local env=$1
    local compose_file="docker-compose.$env.yml"
    
    log "Checking $env database health..."
    
    # Check database connection
    if docker-compose -f "$compose_file" exec -T db pg_isready -U practica > /dev/null 2>&1; then
        log_success "$env database is healthy"
        
        # Check database size
        local db_size
        db_size=$(docker-compose -f "$compose_file" exec -T db psql -U practica -d practica_$env -c "SELECT pg_size_pretty(pg_database_size('practica_$env'));" -t 2>/dev/null | xargs)
        
        log "Database size: $db_size"
    else
        log_alert "$env database is not responding"
        send_slack_alert "🚨 $env database is not responding!" "critical"
        return 1
    fi
}

# Check Redis health
check_redis_health() {
    local env=$1
    local compose_file="docker-compose.$env.yml"
    
    log "Checking $env Redis health..."
    
    if docker-compose -f "$compose_file" exec -T redis redis-cli ping > /dev/null 2>&1; then
        log_success "$env Redis is healthy"
        
        # Check Redis memory usage
        local redis_memory
        redis_memory=$(docker-compose -f "$compose_file" exec -T redis redis-cli info memory | grep used_memory_human | cut -d: -f2 | xargs)
        
        log "Redis memory usage: $redis_memory"
    else
        log_alert "$env Redis is not responding"
        send_slack_alert "🚨 $env Redis is not responding!" "critical"
        return 1
    fi
}

# Check application logs for errors
check_application_logs() {
    local env=$1
    local compose_file="docker-compose.$env.yml"
    
    log "Checking $env application logs for errors..."
    
    # Get recent error logs
    local error_count
    error_count=$(docker-compose -f "$compose_file" logs --tail=100 backend 2>/dev/null | grep -i "error\|exception\|traceback" | wc -l)
    
    if [ "$error_count" -gt 0 ]; then
        log_alert "$env has $error_count recent errors in logs"
        send_slack_alert "⚠️ $env has $error_count recent errors in logs" "warning"
        
        # Get last few errors
        local recent_errors
        recent_errors=$(docker-compose -f "$compose_file" logs --tail=100 backend 2>/dev/null | grep -i "error\|exception\|traceback" | tail -3)
        
        if [ -n "$recent_errors" ]; then
            log "Recent errors:"
            echo "$recent_errors"
        fi
    else
        log_success "$env application logs are clean"
    fi
}

# Generate monitoring report
generate_report() {
    local env=$1
    local report_file="$MONITORING_DIR/report_${env}_$(date +%Y%m%d_%H%M%S).txt"
    
    log "Generating $env monitoring report..."
    
    {
        echo "=== $env Environment Monitoring Report ==="
        echo "Generated: $(date)"
        echo ""
        
        echo "=== Container Status ==="
        docker-compose -f "docker-compose.$env.yml" ps
        echo ""
        
        echo "=== Resource Usage ==="
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" $(docker-compose -f "docker-compose.$env.yml" ps -q) 2>/dev/null || echo "No containers running"
        echo ""
        
        echo "=== Disk Usage ==="
        df -h
        echo ""
        
        echo "=== Recent Logs ==="
        docker-compose -f "docker-compose.$env.yml" logs --tail=50 backend 2>/dev/null || echo "No logs available"
        
    } > "$report_file"
    
    log_success "Report generated: $report_file"
}

# Monitor single environment
monitor_environment() {
    local env=$1
    
    log "🔍 Starting monitoring for $env environment..."
    
    # Check if environment is running
    if ! docker-compose -f "docker-compose.$env.yml" ps | grep -q "Up"; then
        log_alert "$env environment is not running"
        send_slack_alert "🚨 $env environment is not running!" "critical"
        return 1
    fi
    
    # Service health checks
    local port="8000"
    if [ "$env" = "staging" ]; then
        port="8001"
    fi
    
    check_service_health "$env" "backend" "http://localhost:$port/health/"
    check_service_health "$env" "admin" "http://localhost:$port/admin/"
    
    # Infrastructure checks
    check_container_health "$env"
    check_resource_usage "$env"
    check_disk_usage "$env"
    check_database_health "$env"
    check_redis_health "$env"
    check_application_logs "$env"
    
    # Generate report
    generate_report "$env"
    
    log_success "$env monitoring completed"
}

# Monitor all environments
monitor_all() {
    log "🔍 Starting comprehensive monitoring..."
    
    for env in "${ENVIRONMENTS[@]}"; do
        if [ -f "docker-compose.$env.yml" ]; then
            monitor_environment "$env"
            echo ""
        else
            log "Skipping $env (no compose file found)"
        fi
    done
    
    log_success "Comprehensive monitoring completed"
}

# Continuous monitoring
continuous_monitor() {
    local interval=${1:-300}  # Default 5 minutes
    
    log "🔄 Starting continuous monitoring (interval: ${interval}s)..."
    
    while true; do
        monitor_all
        log "Sleeping for ${interval} seconds..."
        sleep "$interval"
    done
}

# Alert summary
alert_summary() {
    log "📊 Alert Summary"
    
    if [ -f "$ALERT_LOG" ]; then
        local total_alerts
        total_alerts=$(wc -l < "$ALERT_LOG")
        
        echo "Total alerts: $total_alerts"
        echo ""
        
        echo "Recent alerts:"
        tail -10 "$ALERT_LOG"
    else
        echo "No alerts found"
    fi
}

# Main function
main() {
    case "${1:-help}" in
        "env")
            monitor_environment "${2:-development}"
            ;;
        "all")
            monitor_all
            ;;
        "continuous")
            continuous_monitor "${2:-300}"
            ;;
        "report")
            generate_report "${2:-development}"
            ;;
        "alerts")
            alert_summary
            ;;
        "help"|*)
            echo "🔍 Advanced Monitoring & Alerting System"
            echo ""
            echo "Usage: $0 [command] [options]"
            echo ""
            echo "Commands:"
            echo "  env [environment]  - Monitor specific environment (default: development)"
            echo "  all               - Monitor all environments"
            echo "  continuous [sec]   - Continuous monitoring (default: 300s)"
            echo "  report [env]      - Generate monitoring report"
            echo "  alerts            - Show alert summary"
            echo "  help              - Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 env development    # Monitor development environment"
            echo "  $0 env staging        # Monitor staging environment"
            echo "  $0 all                # Monitor all environments"
            echo "  $0 continuous 600     # Continuous monitoring every 10 minutes"
            echo "  $0 report production  # Generate production report"
            echo "  $0 alerts             # Show alert summary"
            echo ""
            echo "Environment Variables:"
            echo "  SLACK_WEBHOOK        - Slack webhook URL for alerts"
            echo ""
            ;;
    esac
}

# Run main function
main "$@"
