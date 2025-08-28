# Amazon SES Setup Guide for Practika

## 🚀 **Why Amazon SES? (vs SendGrid)**

### **💰 Cost Comparison**
- **SendGrid Free**: 100 emails/day, $0/month
- **SendGrid Essentials**: 50K emails/month, **$19/month**
- **Amazon SES**: 62K emails/month, **$0.10/month** (10 cents!)

### **✅ Advantages**
- **Massive cost savings** - 99.5% cheaper than SendGrid
- **AWS integration** - seamless with your existing AWS services
- **Enterprise reliability** - AWS infrastructure backing
- **Unlimited scaling** - handles massive email volumes
- **Better deliverability** - AWS reputation management

## 🔧 **Quick Setup (10 minutes)**

### **1. AWS Account Setup**
- Go to [AWS Console](https://aws.amazon.com/)
- Sign up for AWS account (free tier available)
- Navigate to **SES (Simple Email Service)**

### **2. SES Configuration**
- Select your region (same as S3 bucket)
- Go to **Verified identities**
- Click **"Create identity"**

### **3. Verify Sender Email**
- Choose **"Email address"**
- Enter: `noreply@practika.com` (or your preferred email)
- Check your email and click verification link
- **Status should show "Verified"**

### **4. Get AWS Credentials**
- Go to **IAM** → **Users**
- Create new user with **"Programmatic access"**
- Attach policy: **"AmazonSESFullAccess"**
- Copy **Access Key ID** and **Secret Access Key**

### **5. Set Heroku Environment Variables**
```bash
# Set AWS credentials (same as your S3 setup)
heroku config:set AWS_ACCESS_KEY_ID=your_access_key --app practika
heroku config:set AWS_SECRET_ACCESS_KEY=your_secret_key --app practika

# Set SES sender name
heroku config:set SES_FROM_NAME=Practika --app practika

# Verify your region matches S3
heroku config:set AWS_S3_REGION_NAME=us-east-1 --app practika
```

### **6. Test Email Sending**
```bash
# Test with your email
heroku run python manage.py test_email --to your@email.com --app practika
```

## 📧 **What You Get**

- ✅ **Professional email delivery**
- ✅ **Email verification system working**
- ✅ **Password reset emails**
- ✅ **User registration emails**
- ✅ **Massive cost savings**

## 🚨 **Important Notes**

### **SES Limits (Free Tier)**
- **Sending quota**: 62,000 emails/month
- **Sending rate**: 14 emails/second
- **Sandbox mode**: Initially limited to verified emails only

### **Production Mode**
- **Request production access** in SES console
- **Remove sandbox restrictions**
- **Send to any email address**

### **Domain Verification (Optional)**
- Verify your domain for better deliverability
- Send from `noreply@yourdomain.com`
- Professional branding

## 🔍 **Troubleshooting**

### **Common Issues**
- **"Email address not verified"**: Verify sender email in SES
- **"Sending quota exceeded"**: Request production access
- **"Access denied"**: Check IAM permissions
- **"Region mismatch"**: Ensure SES and S3 regions match

### **Check Configuration**
```bash
# View current email settings
heroku run python manage.py shell --app practika
>>> from django.conf import settings
>>> print(f"Email backend: {settings.EMAIL_BACKEND}")
>>> print(f"AWS Access Key: {'Set' if settings.AWS_ACCESS_KEY_ID else 'Not set'}")
>>> print(f"AWS Secret Key: {'Set' if settings.AWS_SECRET_ACCESS_KEY else 'Not set'}")
```

## 📚 **Next Steps**

1. **Set up AWS account** and SES
2. **Verify sender email** address
3. **Configure Heroku** environment variables
4. **Test email sending**
5. **Request production access** (remove sandbox limits)

## 💡 **Pro Tips**

- **Use same region** for SES and S3
- **Verify domain** for professional branding
- **Monitor sending statistics** in SES console
- **Set up CloudWatch** for email metrics
- **Use SES templates** for consistent emails

## 🎯 **Cost Breakdown**

| Service | Monthly Cost | Emails/Month |
|---------|--------------|--------------|
| SendGrid Free | $0 | 2,000 |
| SendGrid Essentials | $19 | 50,000 |
| **Amazon SES** | **$0.10** | **62,000** |

**Amazon SES saves you $18.90/month for the same email volume!**

## 🚀 **Ready to Deploy**

Once you set the AWS environment variables, your app will automatically:
1. **Switch to Amazon SES** backend
2. **Start sending emails** through AWS
3. **Reduce costs** by 99.5%
4. **Improve reliability** with AWS infrastructure

**Amazon SES is the smart choice for cost-conscious startups!** 🎯
