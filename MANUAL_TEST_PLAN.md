# 🧪 Manual Test Plan for Practika.jpagan.com

## **📋 Test Session Setup**

### **Test Environment**
- **Base URL**: https://practika.jpagan.com
- **Test Date**: _______________
- **Tester**: _______________
- **Browser**: _______________
- **Device**: _______________
- **Network**: _______________

### **Test Data Preparation**
- **Test Video Files**: Prepare MP4 files (5-50MB) for upload testing
- **Test User Accounts**: Create test accounts for different user roles
- **Test Comments**: Prepare sample comment text for testing

---

## **🔐 Authentication & User Management**

### **1. User Registration Flow**
**URL**: `https://practika.jpagan.com/accounts/signup/`

- [ ] **Navigate to signup page**
  - [ ] Verify page loads correctly
  - [ ] Check form fields are present (username, email, password)
  - [ ] Verify password strength requirements are displayed

- [ ] **Test valid registration**
  - [OK] Enter valid username (e.g., `testuser_2024`)
  - [OK] Enter valid email (e.g., `test@example.com`)
  - [OK] Enter strong password (e.g., `TestPass123!`)
  - [OK] Submit form
  - [OK] Verify success message or redirect
  - [X] Check if email verification is required

- [ ] **Test invalid registration scenarios**
  - [ ] Try registering with existing username
  - [ ] Try registering with invalid email format
  - [ ] Try registering with weak password
  - [ ] Try submitting empty form
  - [ ] Verify appropriate error messages

### **2. User Login Flow**
**URL**: `https://practika.jpagan.com/exercises/login/`

- [ ] **Test successful login**
  - [ ] Enter valid username/email
  - [ ] Enter correct password
  - [ ] Submit form
  - [ ] Verify redirect to exercises list
  - [ ] Verify user is authenticated

- [ ] **Test login security**
  - [ ] Try incorrect password
  - [ ] Try non-existent username
  - [ ] Try empty credentials
  - [ ] Verify rate limiting after multiple failed attempts
  - [ ] Check if account lockout works

### **3. User Logout**
**URL**: `https://practika.jpagan.com/exercises/logout/`

- [ ] **Test logout functionality**
  - [ ] Click logout while logged in
  - [ ] Verify user is logged out
  - [ ] Verify redirect to login page
  - [ ] Try accessing protected pages after logout
  - [ ] Verify session is properly cleared

### **4. Password Reset Flow**
**URL**: `https://practika.jpagan.com/accounts/password-reset/`

- [ ] **Test password reset request**
  - [ ] Enter valid email address
  - [ ] Submit reset request
  - [ ] Verify confirmation message
  - [ ] Check if reset email is sent (if email is configured)

### **5. Email Verification**
**URL**: `https://practika.jpagan.com/accounts/verify-email/`

- [ ] **Test email verification**
  - [ ] Access verification page with valid token
  - [ ] Verify account is marked as verified
  - [ ] Test resend verification functionality

---

## **📚 Exercise Management**

### **6. Exercise List View**
**URL**: `https://practika.jpagan.com/exercises/`

- [ ] **Test unauthenticated access**
  - [ ] Visit exercises list without login
  - [ ] Verify redirect to login page
  - [ ] Verify proper authentication flow

- [ ] **Test authenticated access**
  - [ ] Login and visit exercises list
  - [ ] Verify exercises are displayed
  - [ ] Check exercise details (title, description, video)
  - [ ] Test pagination if multiple exercises exist

### **7. Exercise Creation**
**URL**: `https://practika.jpagan.com/exercises/create/`

- [ ] **Test exercise creation form**
  - [ ] Verify form loads correctly
  - [ ] Check all required fields are present
  - [ ] Test form validation

- [ ] **Test video upload functionality**
  - [ ] Select valid video file (MP4, 5-50MB)
  - [ ] Verify file upload progress
  - [ ] Check MIME type validation works
  - [ ] Test file size limits
  - [ ] Verify upload success

- [ ] **Test exercise submission**
  - [ ] Fill in exercise details
  - [ ] Upload video
  - [ ] Submit form
  - [ ] Verify exercise is created
  - [ ] Check redirect to exercise detail page

### **8. Exercise Detail View**
**URL**: `https://practika.jpagan.com/exercises/{exercise_id}/`

- [ ] **Test exercise detail page**
  - [ ] Navigate to specific exercise
  - [ ] Verify exercise information displays correctly
  - [ ] Test video playback functionality
  - [ ] Check video controls (play, pause, volume, fullscreen)
  - [ ] Verify video quality on different screen sizes

- [ ] **Test exercise permissions**
  - [ ] Try accessing exercise as different user
  - [ ] Verify proper access controls
  - [ ] Test edit/delete permissions if applicable

---

## **💬 Comments System**

### **9. Comment Creation**
**URL**: `https://practika.jpagan.com/comments/add/{exercise_id}/`

- [ ] **Test comment form**
  - [ ] Navigate to comment creation page
  - [ ] Verify form loads correctly
  - [ ] Test form validation

- [ ] **Test comment submission**
  - [ ] Enter comment text
  - [ ] Set timestamp if applicable
  - [ ] Submit comment
  - [ ] Verify comment is saved
  - [ ] Check redirect to exercise detail

### **10. Comment Management**
**URL**: `https://practika.jpagan.com/comments/`

- [ ] **Test comment editing**
  - [ ] Navigate to edit comment page
  - [ ] Modify comment text
  - [ ] Submit changes
  - [ ] Verify changes are saved

- [ ] **Test comment deletion**
  - [ ] Navigate to delete comment page
  - [ ] Confirm deletion
  - [ ] Verify comment is removed
  - [ ] Check proper redirect

### **11. Comment Display**
- [ ] **Test comment viewing**
  - [ ] View comments on exercise detail page
  - [ ] Verify comments display correctly
  - [ ] Check comment timestamps
  - [ ] Test comment sorting (if available)
  - [ ] Verify pagination for many comments

---

## **👥 User Dashboards**

### **12. Student Dashboard**
**URL**: `https://practika.jpagan.com/accounts/dashboard/`

- [ ] **Test student dashboard**
  - [ ] Login as student user
  - [ ] Navigate to dashboard
  - [ ] Verify dashboard loads correctly
  - [ ] Check exercise progress display
  - [ ] Test navigation to exercises
  - [ ] Verify personal information display

### **13. Teacher Dashboard**
**URL**: `https://practika.jpagan.com/accounts/teacher/`

- [ ] **Test teacher dashboard**
  - [ ] Login as teacher user
  - [ ] Navigate to teacher dashboard
  - [ ] Verify dashboard loads correctly
  - [ ] Check student list display
  - [ ] Test exercise management features
  - [ ] Verify progress tracking functionality

---

## **🔧 API Endpoints**

### **14. Exercise API**
**URL**: `https://practika.jpagan.com/exercises/api/exercises/`

- [ ] **Test API authentication**
  - [ ] Try accessing API without authentication
  - [ ] Verify proper 401 response
  - [ ] Test with valid authentication

- [ ] **Test API endpoints**
  - [ ] GET /exercises/api/exercises/ (list exercises)
  - [ ] POST /exercises/api/exercises/ (create exercise)
  - [ ] GET /exercises/api/exercises/{id}/ (get exercise)
  - [ ] PUT /exercises/api/exercises/{id}/ (update exercise)
  - [ ] DELETE /exercises/api/exercises/{id}/ (delete exercise)

### **15. Comments API**
**URL**: `https://practika.jpagan.com/comments/video-comments/`

- [ ] **Test comments API**
  - [ ] GET /comments/video-comments/ (list comments)
  - [ ] POST /comments/video-comments/ (create comment)
  - [ ] GET /comments/video-comments/{id}/ (get comment)
  - [ ] PUT /comments/video-comments/{id}/ (update comment)
  - [ ] DELETE /comments/video-comments/{id}/ (delete comment)

---

## **🔍 Core Functionality**

### **16. Health Check**
**URL**: `https://practika.jpagan.com/core/health/`

- [ ] **Test health endpoint**
  - [ ] Verify endpoint returns 200 OK
  - [ ] Check response format (JSON)
  - [ ] Verify health status is "healthy"
  - [ ] Check database connectivity status
  - [ ] Verify storage status

### **17. Admin Interface**
**URL**: `https://practika.jpagan.com/admin/`

- [ ] **Test admin access**
  - [ ] Login as admin user
  - [ ] Verify admin interface loads
  - [ ] Test user management
  - [ ] Test exercise management
  - [ ] Test comment management

---

## **📱 Responsive Design Testing**

### **18. Desktop Testing**
- [ ] **Test on desktop browsers**
  - [ ] Chrome (latest)
  - [ ] Firefox (latest)
  - [ ] Safari (latest)
  - [ ] Edge (latest)
  - [ ] Verify layout works correctly
  - [ ] Test all functionality

### **19. Tablet Testing**
- [ ] **Test on tablet devices**
  - [ ] iPad (Safari)
  - [ ] Android tablet (Chrome)
  - [ ] Verify responsive layout
  - [ ] Test touch interactions
  - [ ] Verify video player works

### **20. Mobile Testing**
- [ ] **Test on mobile devices**
  - [ ] iPhone (Safari)
  - [ ] Android phone (Chrome)
  - [ ] Verify mobile layout
  - [ ] Test touch interactions
  - [ ] Verify form usability
  - [ ] Test video playback

---

## **🚨 Error Handling & Edge Cases**

### **21. Network Issues**
- [ ] **Test network interruptions**
  - [ ] Interrupt connection during video upload
  - [ ] Test page refresh during form submission
  - [ ] Verify proper error messages
  - [ ] Test retry functionality

### **22. Invalid Input Testing**
- [ ] **Test form validation**
  - [ ] Submit forms with invalid data
  - [ ] Test file upload with invalid files
  - [ ] Test XSS attempts in comments
  - [ ] Verify proper sanitization

### **23. Performance Testing**
- [ ] **Test application performance**
  - [ ] Measure page load times
  - [ ] Test video upload speed
  - [ ] Test video playback performance
  - [ ] Verify no memory leaks

---

## **🔒 Security Testing**

### **24. Authentication Security**
- [ ] **Test authentication security**
  - [ ] Try accessing protected pages without login
  - [ ] Test session timeout
  - [ ] Verify CSRF protection
  - [ ] Test password strength requirements

### **25. Data Protection**
- [ ] **Test data security**
  - [ ] Verify HTTPS is enforced
  - [ ] Test sensitive data exposure
  - [ ] Verify proper access controls
  - [ ] Test file upload security

---

## **📊 Test Results Summary**

### **Test Results**
- **Total Tests**: _______________
- **Passed**: _______________
- **Failed**: _______________
- **Blocked**: _______________

### **Critical Issues Found**
1. **Issue**: _______________
   - **Severity**: High/Medium/Low
   - **Steps to Reproduce**: _______________
   - **Expected**: _______________
   - **Actual**: _______________

2. **Issue**: _______________
   - **Severity**: High/Medium/Low
   - **Steps to Reproduce**: _______________
   - **Expected**: _______________
   - **Actual**: _______________

### **Recommendations**
- **Immediate Actions**: _______________
- **Future Improvements**: _______________
- **Additional Testing Needed**: _______________

---

## **✅ Success Criteria**

Your Practika app is ready for production when:

✅ **All authentication flows work correctly**
✅ **Exercise creation and management functions properly**
✅ **Video upload and playback work reliably**
✅ **Comments system functions correctly**
✅ **User dashboards display appropriate information**
✅ **API endpoints return correct responses**
✅ **Application is responsive on all devices**
✅ **Error handling is user-friendly**
✅ **Security measures are properly implemented**
✅ **Performance meets acceptable standards**

**Ready to launch! 🚀**

---

## **🎯 Quick Test Checklist**

For a quick validation, test these critical paths:

1. **User Registration & Login** ✅
2. **Exercise Creation with Video Upload** ✅
3. **Exercise Detail View & Video Playback** ✅
4. **Comment Creation & Display** ✅
5. **User Dashboard Access** ✅
6. **Mobile Responsiveness** ✅
7. **API Endpoint Functionality** ✅
8. **Error Handling** ✅

**If all above pass, your app is production-ready!**
