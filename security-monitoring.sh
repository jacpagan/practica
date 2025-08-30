#!/bin/bash

# Security Monitoring Script for Practika Production Environment
# This script monitors security events and provides alerts

set -e

ENVIRONMENT_NAME="practika-prod"
PRIMARY_DOMAIN="jpagan.com"
SECONDARY_DOMAIN="jacpagan.com"

echo "🔒 Practika Security Monitoring Dashboard"
echo "========================================"
echo "Environment: $ENVIRONMENT_NAME"
echo "Primary Domain: $PRIMARY_DOMAIN"
echo "Secondary Domain: $SECONDARY_DOMAIN"
echo "Date: $(date)"
echo ""

# Function to check WAF metrics
check_waf_metrics() {
    echo "🛡️  WAF Security Metrics:"
    echo "------------------------"
    
    # Get blocked requests in last 24 hours
    BLOCKED_REQUESTS=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/WAFV2 \
        --metric-name BlockedRequests \
        --dimensions Name=WebACL,Value="${ENVIRONMENT_NAME}-web-acl" \
        --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 3600 \
        --statistics Sum \
        --query 'Datapoints[0].Sum' \
        --output text 2>/dev/null || echo "0")
    
    echo "Blocked Requests (24h): $BLOCKED_REQUESTS"
    
    # Get allowed requests
    ALLOWED_REQUESTS=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/WAFV2 \
        --metric-name AllowedRequests \
        --dimensions Name=WebACL,Value="${ENVIRONMENT_NAME}-web-acl" \
        --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 3600 \
        --statistics Sum \
        --query 'Datapoints[0].Sum' \
        --output text 2>/dev/null || echo "0")
    
    echo "Allowed Requests (24h): $ALLOWED_REQUESTS"
    
    # Calculate block rate
    if [ "$ALLOWED_REQUESTS" != "0" ]; then
        BLOCK_RATE=$(echo "scale=2; $BLOCKED_REQUESTS * 100 / ($BLOCKED_REQUESTS + $ALLOWED_REQUESTS)" | bc 2>/dev/null || echo "0")
        echo "Block Rate: ${BLOCK_RATE}%"
    fi
    echo ""
}

# Function to check application logs for security events
check_security_logs() {
    echo "📊 Security Log Analysis:"
    echo "------------------------"
    
    # Check for failed login attempts
    FAILED_LOGINS=$(aws logs filter-log-events \
        --log-group-name "/ecs/${ENVIRONMENT_NAME}" \
        --start-time $(date -u -d '24 hours ago' +%s)000 \
        --filter-pattern "Failed login attempt" \
        --query 'events | length(@)' \
        --output text 2>/dev/null || echo "0")
    
    echo "Failed Login Attempts (24h): $FAILED_LOGINS"
    
    # Check for suspicious IPs
    SUSPICIOUS_IPS=$(aws logs filter-log-events \
        --log-group-name "/ecs/${ENVIRONMENT_NAME}" \
        --start-time $(date -u -d '24 hours ago' +%s)000 \
        --filter-pattern "suspicious OR attack OR exploit" \
        --query 'events | length(@)' \
        --output text 2>/dev/null || echo "0")
    
    echo "Suspicious Events (24h): $SUSPICIOUS_IPS"
    echo ""
}

# Function to check SSL certificate status
check_ssl_certificate() {
    echo "🔐 SSL Certificate Status:"
    echo "-------------------------"
    
    CERT_ARN=$(aws cloudformation describe-stacks \
        --stack-name practika-infrastructure \
        --query 'Stacks[0].Outputs[?OutputKey==`SSLCertificateARN`].OutputValue' \
        --output text 2>/dev/null || echo "Not found")
    
    if [ "$CERT_ARN" != "Not found" ]; then
        CERT_STATUS=$(aws acm describe-certificate \
            --certificate-arn "$CERT_ARN" \
            --query 'Certificate.Status' \
            --output text 2>/dev/null || echo "Unknown")
        
        echo "Certificate Status: $CERT_STATUS"
        
        if [ "$CERT_STATUS" = "ISSUED" ]; then
            echo "✅ SSL Certificate is valid and active"
        else
            echo "⚠️  SSL Certificate status: $CERT_STATUS"
        fi
    else
        echo "❌ SSL Certificate not found"
    fi
    echo ""
}

# Function to check domain DNS status
check_domain_status() {
    echo "🌐 Domain Status:"
    echo "----------------"
    
    # Check if domain resolves
    if nslookup "$DOMAIN_NAME" >/dev/null 2>&1; then
        echo "✅ Domain $DOMAIN_NAME resolves correctly"
    else
        echo "❌ Domain $DOMAIN_NAME does not resolve"
    fi
    
    # Check HTTPS availability
    if curl -s -I "https://$DOMAIN_NAME" >/dev/null 2>&1; then
        echo "✅ HTTPS is working for $DOMAIN_NAME"
    else
        echo "❌ HTTPS not working for $DOMAIN_NAME"
    fi
    
    # Check subdomain
    if curl -s -I "https://practika.$DOMAIN_NAME" >/dev/null 2>&1; then
        echo "✅ Subdomain practika.$DOMAIN_NAME is accessible"
    else
        echo "⚠️  Subdomain practika.$DOMAIN_NAME not accessible"
    fi
    echo ""
}

# Function to check application health
check_app_health() {
    echo "🏥 Application Health:"
    echo "---------------------"
    
    # Check main domain health
    if curl -s "https://$DOMAIN_NAME/core/health/" >/dev/null 2>&1; then
        echo "✅ Main application is healthy"
    else
        echo "❌ Main application health check failed"
    fi
    
    # Check subdomain health
    if curl -s "https://practika.$DOMAIN_NAME/core/health/" >/dev/null 2>&1; then
        echo "✅ Practika subdomain is healthy"
    else
        echo "❌ Practika subdomain health check failed"
    fi
    echo ""
}

# Function to generate security report
generate_security_report() {
    echo "📋 Security Report Summary:"
    echo "==========================="
    
    # Count total security events
    TOTAL_SECURITY_EVENTS=$((FAILED_LOGINS + SUSPICIOUS_IPS + BLOCKED_REQUESTS))
    
    if [ "$TOTAL_SECURITY_EVENTS" -eq 0 ]; then
        echo "✅ No security events detected in the last 24 hours"
    elif [ "$TOTAL_SECURITY_EVENTS" -lt 10 ]; then
        echo "⚠️  Low security activity detected: $TOTAL_SECURITY_EVENTS events"
    else
        echo "🚨 High security activity detected: $TOTAL_SECURITY_EVENTS events"
        echo "   Consider reviewing security logs and WAF rules"
    fi
    
    echo ""
    echo "🔔 Security Alerts:"
    echo "-------------------"
    
    # Alert conditions
    if [ "$FAILED_LOGINS" -gt 50 ]; then
        echo "🚨 ALERT: High number of failed login attempts ($FAILED_LOGINS)"
    fi
    
    if [ "$BLOCKED_REQUESTS" -gt 100 ]; then
        echo "🚨 ALERT: High number of blocked requests ($BLOCKED_REQUESTS)"
    fi
    
    if [ "$SUSPICIOUS_IPS" -gt 10 ]; then
        echo "🚨 ALERT: Multiple suspicious events detected ($SUSPICIOUS_IPS)"
    fi
}

# Main execution
main() {
    check_waf_metrics
    check_security_logs
    check_ssl_certificate
    check_domain_status
    check_app_health
    generate_security_report
    
    echo "🔒 Security monitoring completed at $(date)"
    echo "Run this script regularly to monitor your production environment"
}

# Run main function
main "$@"
