#!/bin/bash

# Status checker for Practika documentation deployment

DISTRIBUTION_ID="E22Y12BWA38HPN"
DOMAIN_NAME="practika.docs.jpagan.com"

echo "🔍 Practika Documentation Deployment Status"
echo "==========================================="
echo ""

# Check CloudFront distribution status
echo "📊 CloudFront Distribution Status:"
STATUS=$(aws cloudfront get-distribution --id "$DISTRIBUTION_ID" --query 'Distribution.Status' --output text)
echo "Status: $STATUS"

if [ "$STATUS" = "Deployed" ]; then
    echo "✅ Distribution is fully deployed!"
else
    echo "⏳ Distribution is still being deployed..."
fi

echo ""
echo "🌐 Available URLs:"
echo "1. CloudFront URL (working now):"
echo "   https://drgu5fb985zfq.cloudfront.net"
echo ""
echo "2. Custom Domain (DNS configured, waiting for CloudFront):"
echo "   https://$DOMAIN_NAME"
echo ""

# Check DNS resolution
echo "🔍 DNS Resolution Check:"
if nslookup "$DOMAIN_NAME" > /dev/null 2>&1; then
    echo "✅ DNS is resolving correctly"
else
    echo "⏳ DNS may still be propagating"
fi

echo ""
echo "📝 Next Steps:"
echo "1. The CloudFront URL is working now"
echo "2. Wait 5-10 minutes for CloudFront deployment to complete"
echo "3. The custom domain will work once deployment is done"
echo "4. Test both URLs to confirm everything works"

echo ""
echo "🎯 Quick Test Commands:"
echo "curl -I https://drgu5fb985zfq.cloudfront.net"
echo "curl -I https://$DOMAIN_NAME"
