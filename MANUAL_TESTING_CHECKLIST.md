# 🧪 Manual Testing Checklist for Practika.jpagan.com

## **🌐 Browser Testing Setup**

### **Required Browsers**
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Chrome (Android)
- [ ] Mobile Safari (iOS)

### **Test Environment**
- [ ] Desktop (1920x1080)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

---

## **🔐 User Authentication Flow**

### **Registration Process**
- [ ] Navigate to `https://practika.jpagan.com`
- [ ] Click "Sign Up" or "Register"
- [ ] Enter valid username (e.g., `testuser123`)
- [ ] Enter valid password (e.g., `TestPass123!`)
- [ ] Submit registration form
- [ ] Verify redirect to exercise list or welcome page
- [ ] Verify user is logged in

### **Login Process**
- [ ] Navigate to login page
- [ ] Enter registered username
- [ ] Enter correct password
- [ ] Submit login form
- [ ] Verify successful login
- [ ] Verify redirect to appropriate page

### **Logout Process**
- [ ] Click logout button/link
- [ ] Verify user is logged out
- [ ] Verify redirect to login page
- [ ] Verify protected pages require login

---

## **📹 Video Upload & Management**

### **Video Upload**
- [ ] Navigate to video upload page
- [ ] Select video file (MP4, WebM, MOV)
- [ ] Verify file size validation (max 100MB)
- [ ] Submit upload
- [ ] Verify upload progress indicator
- [ ] Verify successful upload message
- [ ] Verify video appears in video list

### **Video Playback**
- [ ] Click on uploaded video
- [ ] Verify video player loads
- [ ] Test play/pause functionality
- [ ] Test volume controls
- [ ] Test fullscreen mode
- [ ] Verify video quality on different screen sizes

### **Video List**
- [ ] Navigate to video list page
- [ ] Verify uploaded videos appear
- [ ] Test video search/filter (if available)
- [ ] Test pagination (if multiple videos)
- [ ] Verify video thumbnails load correctly

---

## **✂️ Video Clip Creation (MVP Core)**

### **Clip Selection Interface**
- [ ] Open video in clip creation mode
- [ ] Verify timeline scrubber appears
- [ ] Test dragging to select time range
- [ ] Test manual time input fields
- [ ] Verify start/end time validation
- [ ] Test preview of selected clip

### **Clip Creation Process**
- [ ] Select time range (e.g., 10s to 20s)
- [ ] Click "Create Clip" button
- [ ] Verify processing indicator appears
- [ ] Wait for processing completion
- [ ] Verify clip creation success message
- [ ] Verify clip appears in clip list

### **Clip Management**
- [ ] View created clips
- [ ] Test clip playback
- [ ] Verify clip duration matches selection
- [ ] Test clip deletion (if available)
- [ ] Test clip sharing (if available)

---

## **💬 Comments System**

### **Adding Comments**
- [ ] Navigate to video with comments enabled
- [ ] Click "Add Comment" or comment area
- [ ] Enter comment text
- [ ] Set timestamp (if applicable)
- [ ] Submit comment
- [ ] Verify comment appears in list
- [ ] Verify comment timestamp is correct

### **Viewing Comments**
- [ ] Load video with existing comments
- [ ] Verify comments display correctly
- [ ] Test comment sorting (newest/oldest)
- [ ] Test comment pagination (if many comments)
- [ ] Verify comment timestamps are accurate

### **Comment Interactions**
- [ ] Test comment editing (if available)
- [ ] Test comment deletion (if available)
- [ ] Test comment replies (if threaded)
- [ ] Test comment likes/helpful votes (if available)

---

## **📊 Teacher Dashboard (if applicable)**

### **Student Progress View**
- [ ] Login as teacher/admin
- [ ] Navigate to teacher dashboard
- [ ] Verify student list loads
- [ ] Verify exercise completion status
- [ ] Test student filtering/search
- [ ] Verify progress metrics display

### **Exercise Management**
- [ ] View exercise submissions
- [ ] Test exercise approval/rejection
- [ ] Test feedback submission
- [ ] Verify notification system (if available)

---

## **🔧 Technical Functionality**

### **Responsive Design**
- [ ] Test on desktop (1920x1080)
- [ ] Test on tablet (768x1024)
- [ ] Test on mobile (375x667)
- [ ] Verify navigation menu works on mobile
- [ ] Verify video player is responsive
- [ ] Verify forms are usable on touch devices

### **Performance**
- [ ] Test page load times (< 3 seconds)
- [ ] Test video upload speed
- [ ] Test video playback smoothness
- [ ] Test clip processing time
- [ ] Verify no memory leaks during extended use

### **Error Handling**
- [ ] Test invalid login credentials
- [ ] Test invalid video file upload
- [ ] Test network interruption during upload
- [ ] Test server error responses
- [ ] Verify user-friendly error messages

### **Security**
- [ ] Test XSS protection in comments
- [ ] Test CSRF protection on forms
- [ ] Verify HTTPS is enforced
- [ ] Test session timeout
- [ ] Verify sensitive data is not exposed

---

## **🎯 MVP Core Loop Testing**

### **Complete Upload → Reply → Compare Flow**
1. [ ] **Upload**: Upload a test video
2. [ ] **Create Clip**: Create a clip from the video
3. [ ] **Add Comment**: Add a comment to the clip
4. [ ] **Verify Data**: Ensure all data is properly connected
5. [ ] **Test Persistence**: Refresh page and verify data persists

### **Teacher Stack View**
1. [ ] **Login as Teacher**: Access teacher dashboard
2. [ ] **View Stacks**: See exercise × student combinations
3. [ ] **Review Submissions**: Check student work
4. [ ] **Provide Feedback**: Add comments/feedback
5. [ ] **Track Progress**: Monitor student improvement

---

## **📱 Mobile-Specific Testing**

### **Touch Interactions**
- [ ] Test video timeline scrubbing on touch
- [ ] Test clip selection with touch gestures
- [ ] Test comment input on mobile keyboard
- [ ] Verify tap targets are appropriately sized

### **Mobile Performance**
- [ ] Test video playback on mobile data
- [ ] Test upload functionality on slower connections
- [ ] Verify app works offline (if applicable)
- [ ] Test battery usage during extended use

---

## **🚨 Critical Issues to Watch For**

### **High Priority**
- [ ] Video upload fails completely
- [ ] Clip creation doesn't work
- [ ] Comments don't save
- [ ] User can't log in
- [ ] App crashes on mobile

### **Medium Priority**
- [ ] Slow page load times
- [ ] Video quality issues
- [ ] UI elements not responsive
- [ ] Error messages unclear

### **Low Priority**
- [ ] Minor UI alignment issues
- [ ] Spelling/grammar in text
- [ ] Performance optimizations

---

## **📝 Test Results Template**

### **Test Session Information**
- **Date**: _______________
- **Tester**: _______________
- **Browser**: _______________
- **Device**: _______________
- **Network**: _______________

### **Results Summary**
- **Total Tests**: _______________
- **Passed**: _______________
- **Failed**: _______________
- **Blocked**: _______________

### **Issues Found**
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

## **🎉 Success Criteria**

Your Practika app is ready for production when:

✅ **All critical functionality works** (upload, clip creation, comments)
✅ **User authentication is secure and reliable**
✅ **Video processing works correctly**
✅ **App is responsive on all devices**
✅ **Performance meets acceptable standards**
✅ **Error handling is user-friendly**
✅ **Data persistence is reliable**

**Ready to launch! 🚀**
