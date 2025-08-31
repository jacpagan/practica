# 🧪 Manual Test Plan - Practika HTTPS Production

## **Test Environment**
- **Production URL**: `https://practika.jpagan.com/`
- **Health Check**: `https://practika.jpagan.com/core/health/`
- **Date**: August 31, 2025
- **Architecture**: ECS Fargate + RDS PostgreSQL + S3 + HTTPS ALB

---

## **🔍 Pre-Test Checklist**

### **Infrastructure Health**
- [ ] HTTPS certificate is valid (green lock in browser)
- [ ] DNS resolves correctly (`nslookup practika.jpagan.com`)
- [ ] Load balancer target is healthy
- [ ] ECS task is running
- [ ] Database is accessible

### **Browser Setup**
- [ ] Clear browser cache and cookies
- [ ] Test in Chrome/Firefox/Safari
- [ ] Test on mobile device
- [ ] Test in incognito/private mode

---

## **🌐 HTTPS & Security Tests**

### **1. HTTPS Certificate Validation**
**Test**: Verify SSL certificate is valid and trusted
- [ ] Visit `https://practika.jpagan.com/`
- [ ] Check browser shows green lock icon
- [ ] Verify certificate is issued by AWS Certificate Manager
- [ ] Check certificate expiration date (should be > 1 year)

**Expected Result**: ✅ Green lock, valid certificate, no security warnings

### **2. HTTP to HTTPS Redirect**
**Test**: Verify automatic redirect from HTTP to HTTPS
- [ ] Visit `http://practika.jpagan.com/`
- [ ] Verify automatic redirect to `https://practika.jpagan.com/`
- [ ] Check redirect status code is 301 (permanent)

**Expected Result**: ✅ Automatic redirect to HTTPS, status 301

### **3. Security Headers**
**Test**: Verify security headers are properly configured
- [ ] Open browser developer tools → Network tab
- [ ] Visit `https://practika.jpagan.com/`
- [ ] Check response headers for:
  - [ ] `Strict-Transport-Security` (HSTS)
  - [ ] `X-Frame-Options`
  - [ ] `X-Content-Type-Options`
  - [ ] `Referrer-Policy`

**Expected Result**: ✅ Security headers present and properly configured

---

## **🏠 Core Application Tests**

### **4. Homepage Loading**
**Test**: Verify main application loads correctly
- [ ] Visit `https://practika.jpagan.com/`
- [ ] Check page loads without errors
- [ ] Verify Django admin is accessible at `/admin/`
- [ ] Check static files load (CSS, JS, images)

**Expected Result**: ✅ Page loads, no console errors, static files present

### **5. Health Check Endpoint**
**Test**: Verify application health monitoring
- [ ] Visit `https://practika.jpagan.com/core/health/`
- [ ] Verify JSON response with status "healthy"
- [ ] Check response includes:
  - [ ] Database status
  - [ ] Storage status
  - [ ] Response time
  - [ ] Environment info

**Expected Result**: ✅ JSON response with all health indicators

### **6. Role Selection Flow**
**Test**: Verify student/teacher role selection works
- [ ] Visit `https://practika.jpagan.com/exercises/login/`
- [ ] Check both "I am a Student" and "I am a Teacher" buttons
- [ ] Click "I am a Student" → verify redirect
- [ ] Click "I am a Teacher" → verify redirect
- [ ] Test browser back/forward navigation

**Expected Result**: ✅ Role selection works, proper redirects

---

## **📹 Video Upload & Processing Tests**

### **7. Video Upload Interface**
**Test**: Verify video upload functionality
- [ ] Navigate to video upload page
- [ ] Check file input accepts video formats
- [ ] Verify upload progress indicators
- [ ] Test with small video file (< 10MB)
- [ ] Test with larger video file (10-50MB)

**Expected Result**: ✅ Upload interface works, progress shown

### **8. Video Processing**
**Test**: Verify uploaded videos are processed
- [ ] Upload a test video
- [ ] Check processing status updates
- [ ] Verify video appears in library
- [ ] Test video playback
- [ ] Check video metadata (duration, size)

**Expected Result**: ✅ Videos process correctly, metadata accurate

### **9. Video Clip Creation**
**Test**: Verify clip creation from uploaded videos
- [ ] Select an uploaded video
- [ ] Set start and end times for clip
- [ ] Create clip
- [ ] Verify clip is generated
- [ ] Test clip playback

**Expected Result**: ✅ Clips created successfully, playback works

---

## **💬 Comments & Feedback Tests**

### **10. Comment Creation**
**Test**: Verify comment system works
- [ ] Navigate to exercise with video
- [ ] Add text comment
- [ ] Add video comment (if available)
- [ ] Verify comment appears
- [ ] Test comment editing/deletion

**Expected Result**: ✅ Comments created, displayed, editable

### **11. Exercise Management**
**Test**: Verify exercise creation and management
- [ ] Create new exercise
- [ ] Add video to exercise
- [ ] Set exercise name and description
- [ ] Verify exercise appears in list
- [ ] Test exercise editing

**Expected Result**: ✅ Exercises created, managed, displayed

---

## **👥 User Management Tests**

### **12. User Registration/Login**
**Test**: Verify user authentication works
- [ ] Test user registration (if enabled)
- [ ] Test user login
- [ ] Test password reset (if enabled)
- [ ] Verify session persistence
- [ ] Test logout functionality

**Expected Result**: ✅ Authentication works, sessions persist

### **13. User Profiles**
**Test**: Verify user profile functionality
- [ ] Access user profile page
- [ ] Check profile information display
- [ ] Test profile editing (if available)
- [ ] Verify role-based access

**Expected Result**: ✅ Profiles display, role access works

---

## **📱 Mobile & Responsive Tests**

### **14. Mobile Responsiveness**
**Test**: Verify mobile-friendly interface
- [ ] Test on mobile device
- [ ] Check responsive design
- [ ] Test touch interactions
- [ ] Verify mobile navigation
- [ ] Test mobile video upload

**Expected Result**: ✅ Mobile-friendly, touch interactions work

### **15. Cross-Browser Compatibility**
**Test**: Verify works across browsers
- [ ] Test in Chrome (latest)
- [ ] Test in Firefox (latest)
- [ ] Test in Safari (latest)
- [ ] Test in Edge (latest)
- [ ] Check for browser-specific issues

**Expected Result**: ✅ Works consistently across browsers

---

## **⚡ Performance Tests**

### **16. Page Load Performance**
**Test**: Verify acceptable load times
- [ ] Measure homepage load time
- [ ] Measure video upload page load
- [ ] Measure exercise list load
- [ ] Check for slow-loading resources
- [ ] Test with slow internet connection

**Expected Result**: ✅ Pages load in < 3 seconds

### **17. Video Processing Performance**
**Test**: Verify video processing speed
- [ ] Upload small video (1-5MB)
- [ ] Measure processing time
- [ ] Upload medium video (5-20MB)
- [ ] Measure processing time
- [ ] Check for processing errors

**Expected Result**: ✅ Processing completes in reasonable time

---

## **🔒 Security Tests**

### **18. Input Validation**
**Test**: Verify input sanitization
- [ ] Test XSS prevention in comments
- [ ] Test SQL injection prevention
- [ ] Test file upload restrictions
- [ ] Test CSRF protection
- [ ] Test input length limits

**Expected Result**: ✅ Input properly validated, no security vulnerabilities

### **19. Access Control**
**Test**: Verify proper access controls
- [ ] Test unauthorized access to admin
- [ ] Test user data isolation
- [ ] Test role-based permissions
- [ ] Test session security
- [ ] Test logout security

**Expected Result**: ✅ Proper access controls, no unauthorized access

---

## **📊 Data Integrity Tests**

### **20. Database Operations**
**Test**: Verify data persistence
- [ ] Create test data
- [ ] Verify data saved to database
- [ ] Test data retrieval
- [ ] Test data updates
- [ ] Test data deletion

**Expected Result**: ✅ Data persists correctly, CRUD operations work

### **21. File Storage**
**Test**: Verify S3 file storage
- [ ] Upload test files
- [ ] Verify files stored in S3
- [ ] Test file retrieval
- [ ] Test file deletion
- [ ] Check file permissions

**Expected Result**: ✅ Files stored correctly, accessible

---

## **🚨 Error Handling Tests**

### **22. Error Scenarios**
**Test**: Verify graceful error handling
- [ ] Test with invalid file uploads
- [ ] Test with network interruptions
- [ ] Test with invalid form submissions
- [ ] Test with missing required fields
- [ ] Check error messages are user-friendly

**Expected Result**: ✅ Graceful error handling, helpful error messages

### **23. Recovery Scenarios**
**Test**: Verify system recovery
- [ ] Test page refresh after errors
- [ ] Test browser back/forward
- [ ] Test session recovery
- [ ] Test form data recovery
- [ ] Test upload recovery

**Expected Result**: ✅ System recovers gracefully from errors

---

## **📈 Monitoring & Logging Tests**

### **24. Application Logs**
**Test**: Verify logging functionality
- [ ] Check Django logs for errors
- [ ] Verify request logging
- [ ] Check error logging
- [ ] Verify performance logging
- [ ] Test log rotation

**Expected Result**: ✅ Logs generated, no critical errors

### **25. Health Monitoring**
**Test**: Verify health check endpoints
- [ ] Test `/core/health/` endpoint
- [ ] Verify database connectivity check
- [ ] Verify storage connectivity check
- [ ] Check response time monitoring
- [ ] Test health check frequency

**Expected Result**: ✅ Health checks pass, monitoring active

---

## **🎯 Test Results Summary**

### **Test Categories**
- [ ] **HTTPS & Security**: ___/5 tests passed
- [ ] **Core Application**: ___/3 tests passed
- [ ] **Video Processing**: ___/3 tests passed
- [ ] **Comments & Exercises**: ___/2 tests passed
- [ ] **User Management**: ___/2 tests passed
- [ ] **Mobile & Responsive**: ___/2 tests passed
- [ ] **Performance**: ___/2 tests passed
- [ ] **Security**: ___/2 tests passed
- [ ] **Data Integrity**: ___/2 tests passed
- [ ] **Error Handling**: ___/2 tests passed
- [ ] **Monitoring**: ___/2 tests passed

### **Overall Results**
- **Total Tests**: 25
- **Passed**: ___/25
- **Failed**: ___/25
- **Success Rate**: ___%

### **Critical Issues Found**
1. _________________________________
2. _________________________________
3. _________________________________

### **Minor Issues Found**
1. _________________________________
2. _________________________________
3. _________________________________

### **Recommendations**
1. _________________________________
2. _________________________________
3. _________________________________

---

## **📝 Test Notes**

**Tester**: _________________
**Date**: _________________
**Environment**: Production (HTTPS)
**Browser**: _________________
**Device**: _________________

**Additional Notes**:
_________________________________
_________________________________
_________________________________

---

*Generated for Practika HTTPS Production Environment*
*Architecture: ECS Fargate + RDS PostgreSQL + S3 + HTTPS ALB*
