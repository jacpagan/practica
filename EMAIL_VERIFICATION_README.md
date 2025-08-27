# Email Verification

This document describes the email verification system implemented in Practika.

## Overview

The email verification system ensures that users verify their email addresses before they can access the application. It uses HMAC-signed tokens with 24-hour expiry and includes comprehensive security features.

## Features

- **HMAC-signed tokens**: Secure, tamper-proof verification links
- **24-hour expiry**: Tokens automatically expire after 24 hours
- **Rate limiting**: Prevents abuse with 3 resends per hour, 10 per day
- **Async email dispatch**: Uses Redis Queue (RQ) for background email sending
- **Security**: No information leakage about user existence or verification status
- **Production-ready**: Supports AWS SES and SendGrid for email delivery

## Architecture

### User Model Changes

- Custom `User` model extends `AbstractUser`
- `email` field is unique and required
- `email_verified_at` field tracks verification timestamp
- `is_active` defaults to `False` for new users

### Token System

- Uses Django's `TimestampSigner` for HMAC-signed tokens
- Token payload: `user_id:email:timestamp`
- Base64-encoded for URL safety
- 24-hour expiry built into the signing mechanism

### Email Flow

1. **Signup**: User creates account → inactive user created → verification email queued
2. **Verification**: User clicks link → token validated → user activated
3. **Login**: Only verified users can login
4. **Resend**: Rate-limited resend functionality

## API Endpoints

### `/verify-email/`
- **Method**: GET
- **Parameters**: `uid` (user ID), `token` (verification token)
- **Response**: Redirect with status message
- **Security**: Validates token signature, expiry, and user match

### `/resend-verification/`
- **Method**: POST
- **Parameters**: `email` (user email)
- **Response**: JSON response with status
- **Rate Limiting**: 3 per hour, 10 per day per IP+email

## Configuration

### Environment Variables

```bash
# Email Backend
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=noreply@practika.com

# Site URL for verification links
SITE_URL=https://your-domain.com

# Redis for RQ (optional, falls back to sync)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=
```

### AWS SES Configuration

```bash
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=email-smtp.us-east-1.amazonaws.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-ses-smtp-username
EMAIL_HOST_PASSWORD=your-ses-smtp-password
DEFAULT_FROM_EMAIL=verified-email@yourdomain.com
```

### SendGrid Configuration

```bash
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=your-sendgrid-api-key
DEFAULT_FROM_EMAIL=verified-email@yourdomain.com
```

## Deployment

### Heroku Setup

1. **Add Redis addon**:
   ```bash
   heroku addons:create heroku-redis:mini
   ```

2. **Set environment variables**:
   ```bash
   heroku config:set EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
   heroku config:set EMAIL_HOST=your-smtp-host
   heroku config:set EMAIL_HOST_USER=your-username
   heroku config:set EMAIL_HOST_PASSWORD=your-password
   heroku config:set DEFAULT_FROM_EMAIL=noreply@yourdomain.com
   heroku config:set SITE_URL=https://your-app.herokuapp.com
   ```

3. **Scale worker dyno**:
   ```bash
   heroku ps:scale worker=1
   ```

### Docker Setup

The system includes a `Procfile` with both web and worker processes. Ensure your Docker setup can handle both.

## Security Features

### Token Security
- HMAC-signed tokens prevent tampering
- 24-hour expiry limits exposure window
- Single-use tokens (invalidated after verification)
- No sensitive data in tokens

### Rate Limiting
- IP-based rate limiting prevents abuse
- Separate limits for hourly (3) and daily (10) resends
- Graceful degradation with friendly error messages

### Information Security
- No leakage of user existence
- No leakage of verification status
- Consistent response messages regardless of input

### CSRF Protection
- All forms include CSRF tokens
- AJAX requests include CSRF headers

## Testing

Comprehensive test suite covers:

- ✅ New signup creates inactive user
- ✅ Verification email is sent on signup
- ✅ Successful email verification
- ✅ Expired token handling
- ✅ Tampered token detection
- ✅ Wrong user token rejection
- ✅ Login blocked for unverified users
- ✅ Login allowed after verification
- ✅ Resend verification success
- ✅ Rate limiting (hourly and daily)
- ✅ Non-existent email handling
- ✅ Already verified user handling
- ✅ Idempotent verification behavior
- ✅ UI banner display
- ✅ Unique email enforcement

Run tests with:
```bash
python manage.py test accounts.tests_email_verification
```

## Troubleshooting

### Common Issues

1. **Emails not sending**:
   - Check email backend configuration
   - Verify SMTP credentials
   - Check Redis connection for RQ

2. **Verification links not working**:
   - Verify `SITE_URL` environment variable
   - Check token expiry (24 hours)
   - Ensure user hasn't already verified

3. **Rate limiting issues**:
   - Check Redis cache connection
   - Verify rate limit keys are being set
   - Clear cache if needed: `python manage.py shell -c "from django.core.cache import cache; cache.clear()"`

### Development Mode

In development, emails are sent to console by default. To test email sending:

```bash
# Use console backend (default)
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend

# Or use file backend
EMAIL_BACKEND=django.core.mail.backends.filebased.EmailBackend
EMAIL_FILE_PATH=/tmp/app-messages
```

## Migration Notes

When deploying to production:

1. **Run migrations**:
   ```bash
   python manage.py migrate
   ```

2. **Existing users**: Existing active users will need to verify their emails on next login attempt

3. **Backward compatibility**: The system maintains backward compatibility for existing users

## Monitoring

Monitor the system with:

- **Email delivery rates**: Check your email provider dashboard
- **Verification success rates**: Monitor application logs
- **Rate limiting**: Watch for 429 responses in logs
- **Queue health**: Monitor RQ worker status and queue length
