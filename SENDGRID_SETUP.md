# SendGrid Setup Guide for Practika

## 🚀 **Quick Setup (5 minutes)**

### 1. **Create SendGrid Account**
- Go to [SendGrid.com](https://sendgrid.com)
- Click "Start for Free"
- Sign up with your email
- Verify your email address

### 2. **Get Your API Key**
- Log into SendGrid dashboard
- Go to **Settings** → **API Keys**
- Click **"Create API Key"**
- Name it: `Practika Production`
- Select **"Restricted Access"** → **"Mail Send"**
- Copy the API key (starts with `SG.`)

### 3. **Verify Your Sender Domain** (Optional but Recommended)
- Go to **Settings** → **Sender Authentication**
- Click **"Verify a Domain"**
- Follow the DNS setup instructions
- This improves email deliverability

### 4. **Set Heroku Environment Variables**
```bash
# Set your SendGrid API key
heroku config:set SENDGRID_API_KEY=SG.your_api_key_here --app practika

# Set sender email (use your verified domain)
heroku config:set SENDGRID_FROM_EMAIL=noreply@yourdomain.com --app practika

# Set sender name
heroku config:set SENDGRID_FROM_NAME=Practika --app practika
```

### 5. **Test Email Sending**
```bash
# Test with your email
heroku run python manage.py test_email --to your@email.com --app practika
```

## 📧 **What This Gives You**

- ✅ **100 emails/day free** (SendGrid free tier)
- ✅ **Professional email delivery**
- ✅ **Email verification system working**
- ✅ **Password reset emails**
- ✅ **User registration emails**

## 🔧 **Technical Details**

### Email Backend
- **SendGrid**: When `SENDGRID_API_KEY` is set
- **Console**: Fallback when no API key (for development)

### Supported Features
- HTML and plain text emails
- CC and BCC recipients
- Error handling and logging
- Automatic fallback

## 🚨 **Important Notes**

1. **Free Tier Limits**: 100 emails/day, 2,000 emails/month
2. **API Key Security**: Never commit API keys to git
3. **Domain Verification**: Improves deliverability significantly
4. **Rate Limits**: SendGrid handles rate limiting automatically

## 🧪 **Testing**

### Test Email Command
```bash
heroku run python manage.py test_email --to test@example.com --app practika
```

### Test User Registration
1. Go to `/exercises/login/`
2. Try to sign up with a new email
3. Check if verification email is sent

## 🔍 **Troubleshooting**

### Common Issues
- **"API key not configured"**: Set `SENDGRID_API_KEY` environment variable
- **"Authentication failed"**: Check API key is correct
- **"Domain not verified"**: Verify your sender domain in SendGrid

### Check Configuration
```bash
# View current email settings
heroku run python manage.py shell --app practika
>>> from django.conf import settings
>>> print(f"Email backend: {settings.EMAIL_BACKEND}")
>>> print(f"SendGrid API key: {'Set' if settings.SENDGRID_API_KEY else 'Not set'}")
```

## 📚 **Next Steps**

1. **Set up SendGrid** (follow steps above)
2. **Test email sending**
3. **Re-enable email verification** (remove temporary bypass)
4. **Set up RQ worker** for background email processing

## 💰 **Costs**

- **SendGrid Free**: $0/month (100 emails/day)
- **SendGrid Essentials**: $19/month (50,000 emails/month)
- **SendGrid Pro**: $89/month (100,000 emails/month)

For most applications, the free tier is sufficient to start.
