# Email Verification System Test Plan

## 🎯 Overview
Test the complete email verification flow on the live application at https://practika-d127ed6da5d2.herokuapp.com/

## 📋 Pre-Test Setup
- [ ] Clear your browser cache/cookies for the site
- [ ] Have access to a test email address
- [ ] Note: In development, emails are sent to console (check Heroku logs)

## 🧪 Test Cases

### 1. User Registration Flow
**URL**: https://practika-d127ed6da5d2.herokuapp.com/exercises/login/

**Steps**:
1. Navigate to the login page
2. Click the "📝 Sign Up" tab
3. Fill in the signup form:
   - Username: `testuser123`
   - Email: `your-test-email@example.com`
   - Password: `testpass123`
   - Confirm Password: `testpass123`
4. Click "📝 Sign Up"

**Expected Results**:
- [ ] Success message: "Account created! Please check your email to verify your account before logging in."
- [ ] User is redirected to login page
- [ ] Signup form is cleared

**Notes**:
```
_________________________________________________
```

### 2. Login Attempt (Unverified User)
**Steps**:
1. Stay on the login page
2. Click "🔑 Login" tab
3. Try to login with the newly created account:
   - Username: `testuser123`
   - Password: `testpass123`
4. Click "🔑 Login"

**Expected Results**:
- [ ] Error message: "Please verify your email address before logging in. Resend verification email"
- [ ] User remains on login page
- [ ] Cannot access the application

**Notes**:
```
_________________________________________________
```

### 3. Resend Verification Email
**Steps**:
1. Click the "Resend verification email" link
2. Enter the email address: `your-test-email@example.com`
3. Click "📧 Resend Verification"

**Expected Results**:
- [ ] Success message: "Verification email sent! Please check your inbox."
- [ ] Form closes and returns to login tab

**Notes**:
```
_________________________________________________
```

### 4. Rate Limiting Test
**Steps**:
1. Try to resend verification email 4 times quickly
2. Note the response after the 3rd attempt

**Expected Results**:
- [ ] After 3 attempts: "Too many requests. Please try again in an hour."
- [ ] Rate limiting is working correctly

**Notes**:
```
_________________________________________________
```

### 5. Email Verification (Simulated)
**Note**: Since this is a development environment, emails go to console logs.

**Steps**:
1. Check Heroku logs for the verification email:
   ```bash
   heroku logs --tail --app practika
   ```
2. Look for email content with verification link
3. Copy the verification URL from the logs
4. Open the verification URL in a new browser tab

**Expected Results**:
- [ ] Email content appears in logs
- [ ] Verification URL is properly formatted
- [ ] Clicking the URL shows: "Email verified successfully! You can now log in."
- [ ] User is redirected to login page with success message

**Notes**:
```
_________________________________________________
```

### 6. Successful Login (After Verification)
**Steps**:
1. On the login page, enter credentials:
   - Username: `testuser123`
   - Password: `testpass123`
2. Click "🔑 Login"

**Expected Results**:
- [ ] Success message: "Welcome back, testuser123!"
- [ ] User is redirected to exercises list
- [ ] Can see the application interface
- [ ] Logout option is available

**Notes**:
```
_________________________________________________
```

### 7. Invalid Token Test
**Steps**:
1. Try to access a verification URL with invalid token:
   ```
   https://practika-d127ed6da5d2.herokuapp.com/accounts/verify-email/?uid=999&token=invalid
   ```

**Expected Results**:
- [ ] Error message: "Invalid or expired verification link."
- [ ] User is redirected to login page with error message

**Notes**:
```
_________________________________________________
```

### 8. Expired Token Test
**Steps**:
1. Wait 25+ hours (or modify system time)
2. Try to use an old verification link

**Expected Results**:
- [ ] Error message: "Invalid or expired verification link."
- [ ] User is redirected to login page with error message

**Notes**:
```
_________________________________________________
```

### 9. UI/UX Verification
**Steps**:
1. Test password visibility toggles (Show/Hide buttons)
2. Test tab switching between Login and Sign Up
3. Test form validation (empty fields, password mismatch)
4. Test responsive design on mobile

**Expected Results**:
- [ ] Password toggles work correctly
- [ ] Tab switching is smooth
- [ ] Form validation shows appropriate errors
- [ ] UI is responsive and accessible

**Notes**:
```
_________________________________________________
```

### 10. Security Features
**Steps**:
1. Try SQL injection in username field
2. Try XSS in email field
3. Try to access admin URLs without authentication
4. Test session timeout (wait 1+ hour)

**Expected Results**:
- [ ] Malicious inputs are sanitized/rejected
- [ ] Admin URLs are protected
- [ ] Session expires after 1 hour

**Notes**:
```
_________________________________________________
```

## 🚨 Common Issues & Troubleshooting

### Issue: "Email not received"
**Solution**: Check Heroku logs - emails go to console in development
```bash
heroku logs --tail --app practika
```

### Issue: "Verification link doesn't work"
**Possible Causes**:
- Token expired (24-hour limit)
- Invalid token format
- User already verified

### Issue: "Rate limiting too strict"
**Solution**: Wait 1 hour or clear Redis cache (if accessible)

### Issue: "Login fails after verification"
**Solution**: Ensure user profile was created correctly

## 📊 Test Results Summary

| Test Case | Status | Notes |
|-----------|--------|-------|
| User Registration | ⬜ Pass / ⬜ Fail | |
| Login Block (Unverified) | ⬜ Pass / ⬜ Fail | |
| Resend Verification | ⬜ Pass / ⬜ Fail | |
| Rate Limiting | ⬜ Pass / ⬜ Fail | |
| Email Verification | ⬜ Pass / ⬜ Fail | |
| Successful Login | ⬜ Pass / ⬜ Fail | |
| Invalid Token | ⬜ Pass / ⬜ Fail | |
| Expired Token | ⬜ Pass / ⬜ Fail | |
| UI/UX | ⬜ Pass / ⬜ Fail | |
| Security | ⬜ Pass / ⬜ Fail | |

## 🎯 Success Criteria
- [ ] All test cases pass
- [ ] Email verification flow works end-to-end
- [ ] Security features are functioning
- [ ] UI is responsive and accessible
- [ ] No critical errors in application logs

## 📝 Final Notes
```
_________________________________________________
_________________________________________________
_________________________________________________
```

**Test Completed By**: _________________  
**Date**: _________________  
**Overall Status**: ⬜ Pass / ⬜ Fail
