#!/bin/bash

# Script to check certificate status and update CloudFront distribution
# This script waits for the SSL certificate to be validated and then updates CloudFront

CERT_ARN="arn:aws:acm:us-east-1:164782963509:certificate/aabbdbf7-9bd1-49c6-9e21-648c20e98ace"
DISTRIBUTION_ID="E22Y12BWA38HPN"
DOMAIN_NAME="practika.docs.jpagan.com"

echo "🔍 Checking certificate validation status..."
echo "Certificate ARN: $CERT_ARN"
echo "Domain: $DOMAIN_NAME"
echo ""

# Function to check certificate status
check_certificate_status() {
    aws acm describe-certificate --certificate-arn "$CERT_ARN" --region us-east-1 --query 'Certificate.Status' --output text
}

# Wait for certificate to be validated
echo "⏳ Waiting for certificate validation..."
while true; do
    STATUS=$(check_certificate_status)
    echo "Current status: $STATUS"
    
    if [ "$STATUS" = "ISSUED" ]; then
        echo "✅ Certificate is now validated!"
        break
    elif [ "$STATUS" = "FAILED" ]; then
        echo "❌ Certificate validation failed!"
        exit 1
    else
        echo "⏳ Still waiting... (checking again in 30 seconds)"
        sleep 30
    fi
done

echo ""
echo "🔧 Updating CloudFront distribution with custom domain..."

# Get current distribution config
aws cloudfront get-distribution-config --id "$DISTRIBUTION_ID" > /tmp/dist-config.json

# Create updated config with custom domain
jq '.DistributionConfig.Aliases.Items = ["'"$DOMAIN_NAME"'"]' /tmp/dist-config.json > /tmp/dist-config-updated.json
jq '.DistributionConfig.Aliases.Quantity = 1' /tmp/dist-config-updated.json > /tmp/dist-config-final.json

# Update viewer certificate
jq '.DistributionConfig.ViewerCertificate.CloudFrontDefaultCertificate = false' /tmp/dist-config-final.json > /tmp/dist-config-cert.json
jq '.DistributionConfig.ViewerCertificate.ACMCertificateArn = "'"$CERT_ARN"'"' /tmp/dist-config-cert.json > /tmp/dist-config-final.json
jq '.DistributionConfig.ViewerCertificate.SSLSupportMethod = "sni-only"' /tmp/dist-config-final.json > /tmp/dist-config-cert.json
jq '.DistributionConfig.ViewerCertificate.MinimumProtocolVersion = "TLSv1.2_2021"' /tmp/dist-config-cert.json > /tmp/dist-config-final.json

# Remove ETag from the config (it's not part of DistributionConfig)
jq 'del(.ETag)' /tmp/dist-config-final.json > /tmp/dist-config-clean.json

# Get ETag for the update
ETAG=$(jq -r '.ETag' /tmp/dist-config.json)

# Update distribution
aws cloudfront update-distribution --id "$DISTRIBUTION_ID" --distribution-config file:///tmp/dist-config-clean.json --if-match "$ETAG"

echo ""
echo "✅ CloudFront distribution updated!"
echo "🌐 Your documentation site will be available at:"
echo "   https://$DOMAIN_NAME"
echo ""
echo "⏳ CloudFront deployment may take 5-10 minutes to complete."
echo "You can check the status with:"
echo "aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'Distribution.Status'"

# Cleanup
rm /tmp/dist-config*.json

echo ""
echo "🎉 Deployment complete!"
echo "📝 Next steps:"
echo "1. Wait for CloudFront deployment to complete"
echo "2. Test the site at https://$DOMAIN_NAME"
echo "3. Share with your team!"
