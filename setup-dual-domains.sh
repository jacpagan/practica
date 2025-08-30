#!/bin/bash

# Final Dual Domain Setup Script for jpagan.com and jacpagan.com
# This script sets up both domains with SSL certificates and DNS configuration

set -e

PRIMARY_DOMAIN="jpagan.com"
SECONDARY_DOMAIN="jacpagan.com"
ENVIRONMENT_NAME="practika-prod"
ALB_DNS="practika-prod-alb-837921104.us-east-1.elb.amazonaws.com"

# Certificate ARNs
PRIMARY_CERT_ARN="arn:aws:acm:us-east-1:164782963509:certificate/5f04ae99-bbef-486a-bc3e-c95b22cc3f9c"
SECONDARY_CERT_ARN="arn:aws:acm:us-east-1:164782963509:certificate/0886e2b7-0830-4aa8-9ca8-564e2131b2d1"

echo "🌐 Dual Domain Setup for $PRIMARY_DOMAIN and $SECONDARY_DOMAIN"
echo "================================================================"
echo "ALB DNS: $ALB_DNS"
echo ""

# Function to get hosted zone ID
get_hosted_zone_id() {
    local domain=$1
    echo "Getting hosted zone ID for $domain..."
    
    HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
        --query "HostedZones[?Name=='${domain}.'].Id" \
        --output text)
    
    if [ -z "$HOSTED_ZONE_ID" ]; then
        echo "❌ Hosted zone not found for $domain"
        echo "Please ensure your domain is registered in Route 53"
        return 1
    fi
    
    echo "✅ Found hosted zone for $domain: $HOSTED_ZONE_ID"
    echo "$HOSTED_ZONE_ID"
}

# Function to add DNS validation record for jpagan.com
add_validation_record_jpagan() {
    local hosted_zone_id=$1
    
    echo "Adding DNS validation record for $PRIMARY_DOMAIN..."
    
    cat > /tmp/ssl-validation-jpagan.json << EOF
{
    "Changes": [
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "_ba8a9feb024168883c3776664f758960.jpagan.com",
                "Type": "CNAME",
                "TTL": 300,
                "ResourceRecords": [
                    {
                        "Value": "_6c57655343fc48cac9e0e1d155ca42d9.xlfgrmvvlj.acm-validations.aws"
                    }
                ]
            }
        }
    ]
}
EOF

    aws route53 change-resource-record-sets \
        --hosted-zone-id "$hosted_zone_id" \
        --change-batch file:///tmp/ssl-validation-jpagan.json
    
    echo "✅ DNS validation record added for $PRIMARY_DOMAIN"
}

# Function to add DNS validation record for jacpagan.com
add_validation_record_jacpagan() {
    local hosted_zone_id=$1
    
    echo "Adding DNS validation record for $SECONDARY_DOMAIN..."
    
    cat > /tmp/ssl-validation-jacpagan.json << EOF
{
    "Changes": [
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "_458d151305f7c14cd8162275e1664235.jacpagan.com",
                "Type": "CNAME",
                "TTL": 300,
                "ResourceRecords": [
                    {
                        "Value": "_d066864cd39b58b3c125b102802fbb4e.xlfgrmvvlj.acm-validations.aws"
                    }
                ]
            }
        }
    ]
}
EOF

    aws route53 change-resource-record-sets \
        --hosted-zone-id "$hosted_zone_id" \
        --change-batch file:///tmp/ssl-validation-jacpagan.json
    
    echo "✅ DNS validation record added for $SECONDARY_DOMAIN"
}

# Function to create A records for domain
create_domain_records() {
    local domain=$1
    local hosted_zone_id=$2
    
    echo "Creating A records for $domain..."
    
    # Main domain A record
    cat > /tmp/main-domain-${domain}.json << EOF
{
    "Changes": [
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "$domain",
                "Type": "A",
                "AliasTarget": {
                    "HostedZoneId": "Z35SXDOTRQ7X7K",
                    "DNSName": "$ALB_DNS",
                    "EvaluateTargetHealth": true
                }
            }
        }
    ]
}
EOF

    aws route53 change-resource-record-sets \
        --hosted-zone-id "$hosted_zone_id" \
        --change-batch file:///tmp/main-domain-${domain}.json
    
    # Practika subdomain A record
    cat > /tmp/practika-subdomain-${domain}.json << EOF
{
    "Changes": [
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "practika.$domain",
                "Type": "A",
                "AliasTarget": {
                    "HostedZoneId": "Z35SXDOTRQ7X7K",
                    "DNSName": "$ALB_DNS",
                    "EvaluateTargetHealth": true
                }
            }
        }
    ]
}
EOF

    aws route53 change-resource-record-sets \
        --hosted-zone-id "$hosted_zone_id" \
        --change-batch file:///tmp/practika-subdomain-${domain}.json
    
    # WWW CNAME record
    cat > /tmp/www-subdomain-${domain}.json << EOF
{
    "Changes": [
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "www.$domain",
                "Type": "CNAME",
                "TTL": 300,
                "ResourceRecords": [
                    {
                        "Value": "$domain"
                    }
                ]
            }
        }
    ]
}
EOF

    aws route53 change-resource-record-sets \
        --hosted-zone-id "$hosted_zone_id" \
        --change-batch file:///tmp/www-subdomain-${domain}.json
    
    echo "✅ DNS records created for $domain"
}

# Function to wait for certificate validation
wait_for_cert_validation() {
    local cert_arn=$1
    local domain=$2
    
    echo "Waiting for certificate validation for $domain..."
    echo "This may take 5-30 minutes..."
    
    while true; do
        STATUS=$(aws acm describe-certificate \
            --certificate-arn "$cert_arn" \
            --query 'Certificate.Status' \
            --output text)
        
        echo "Certificate status for $domain: $STATUS"
        
        if [ "$STATUS" = "ISSUED" ]; then
            echo "✅ SSL Certificate for $domain is now valid!"
            break
        elif [ "$STATUS" = "FAILED" ]; then
            echo "❌ Certificate validation failed for $domain"
            return 1
        else
            echo "⏳ Still waiting for validation... (checking again in 60 seconds)"
            sleep 60
        fi
    done
}

# Function to display final configuration
display_final_config() {
    echo ""
    echo "🎉 Dual Domain Configuration Complete!"
    echo "====================================="
    echo ""
    echo "🌐 Primary Domain ($PRIMARY_DOMAIN):"
    echo "   Main Site: https://$PRIMARY_DOMAIN"
    echo "   Practika App: https://practika.$PRIMARY_DOMAIN"
    echo "   WWW Redirect: https://www.$PRIMARY_DOMAIN"
    echo ""
    echo "🌐 Secondary Domain ($SECONDARY_DOMAIN):"
    echo "   Main Site: https://$SECONDARY_DOMAIN"
    echo "   Practika App: https://practika.$SECONDARY_DOMAIN"
    echo "   WWW Redirect: https://www.$SECONDARY_DOMAIN"
    echo ""
    echo "🔐 SSL Certificates:"
    echo "   Primary: $PRIMARY_CERT_ARN"
    echo "   Secondary: $SECONDARY_CERT_ARN"
    echo ""
    echo "📧 Email Configuration:"
    echo "   Contact: contact@$PRIMARY_DOMAIN"
    echo "   Support: support@$SECONDARY_DOMAIN"
    echo ""
    echo "🔒 Security Features:"
    echo "   - HTTPS/SSL encryption for both domains"
    echo "   - WAF protection (when added)"
    echo "   - Rate limiting"
    echo "   - Camera recording support"
    echo ""
    echo "📊 Monitoring:"
    echo "   Run './security-monitoring.sh' to monitor security events"
    echo ""
    echo "💰 Cost: $30/year for both domains"
    echo "   - $15/year for $PRIMARY_DOMAIN"
    echo "   - $15/year for $SECONDARY_DOMAIN"
}

# Main execution
main() {
    echo "Starting dual domain setup..."
    echo ""
    
    # Setup primary domain (jpagan.com)
    echo ""
    echo "🔧 Setting up $PRIMARY_DOMAIN..."
    PRIMARY_ZONE_ID=$(get_hosted_zone_id "$PRIMARY_DOMAIN")
    add_validation_record_jpagan "$PRIMARY_ZONE_ID"
    create_domain_records "$PRIMARY_DOMAIN" "$PRIMARY_ZONE_ID"
    
    # Setup secondary domain (jacpagan.com)
    echo ""
    echo "🔧 Setting up $SECONDARY_DOMAIN..."
    SECONDARY_ZONE_ID=$(get_hosted_zone_id "$SECONDARY_DOMAIN")
    add_validation_record_jacpagan "$SECONDARY_ZONE_ID"
    create_domain_records "$SECONDARY_DOMAIN" "$SECONDARY_ZONE_ID"
    
    # Wait for certificate validation
    echo ""
    echo "⏳ Waiting for certificate validation..."
    wait_for_cert_validation "$PRIMARY_CERT_ARN" "$PRIMARY_DOMAIN" &
    wait_for_cert_validation "$SECONDARY_CERT_ARN" "$SECONDARY_DOMAIN" &
    wait
    
    # Display final configuration
    display_final_config
    
    # Cleanup
    rm -f /tmp/ssl-validation-*.json
    rm -f /tmp/main-domain-*.json
    rm -f /tmp/practika-subdomain-*.json
    rm -f /tmp/www-subdomain-*.json
    
    echo ""
    echo "✅ Dual domain setup completed successfully!"
}

# Run main function
main "$@"
