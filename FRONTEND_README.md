# LMS Minimal Frontend

This is a minimal frontend implementation for the Learning Management System that covers all the core user stories.

## 🚀 Quick Start

1. **Start the server:**
   ```bash
   source .venv/bin/activate
   python manage.py runserver
   ```

2. **Access the application:**
   - **Main Frontend:** http://localhost:8000/
   - **Admin Interface:** http://localhost:8000/admin/
   - **Login Page:** http://localhost:8000/login/

## 👥 User Accounts

### Admin User
- **Username:** `admin`
- **Password:** `admin123`
- **Capabilities:** Create exercises, manage all content, CRUD any video comments

### Regular User
- **Username:** `user`
- **Password:** `user123`
- **Capabilities:** View exercises, create video comments, reply to comments

## 📚 User Stories Covered

### 1. Admin Creates Exercise
- **Path:** `/create/` (admin only)
- **Features:**
  - Upload video files (MP4, WebM, QuickTime)
  - Set exercise name (≤140 characters)
  - Add optional description
  - Video preview before upload
  - Form validation and error handling

### 2. Users Watch Exercises
- **Path:** `/` (main page)
- **Features:**
  - View all available exercises
  - Watch exercise videos with HTML5 player
  - See exercise metadata (creator, date, description)
  - Responsive grid layout

### 3. Users Create Video Comments
- **Path:** `/` (on any exercise)
- **Features:**
  - Webcam recording via MediaRecorder API
  - Optional text comments
  - Real-time video preview
  - Start/stop recording controls
  - Automatic video upload on submission

### 4. Admin Comments on User Comments
- **Path:** `/` (reply to any comment)
- **Features:**
  - Reply to any video comment with video
  - Admin badge identification
  - Nested comment structure
  - Same video recording interface

## 🎥 Video Recording Features

### Webcam Integration
- **Technology:** MediaRecorder API
- **Format:** WebM with VP8 video + Opus audio
- **Features:**
  - Live preview during recording
  - Start/stop controls
  - Playback of recorded video
  - Automatic blob creation for upload

### Video Upload
- **Accepted Formats:** MP4, WebM, QuickTime
- **Size Limit:** 100MB
- **Processing:** SHA256 checksums, metadata extraction
- **Storage:** Local filesystem with UUID naming

## 🎨 UI Components

### Modern Design
- **Framework:** Pure HTML/CSS/JavaScript
- **Styling:** Clean, responsive design
- **Colors:** Professional color scheme
- **Typography:** System font stack for readability

### Responsive Layout
- **Grid System:** CSS Grid for exercise layout
- **Mobile Friendly:** Responsive video players
- **Navigation:** Clean top navigation bar
- **Cards:** Material design-inspired cards

## 🔐 Authentication & Security

### Session Management
- **Django Sessions:** Secure session handling
- **CSRF Protection:** Built-in CSRF tokens
- **Permission Checks:** Role-based access control

### User Roles
- **Admin/Staff:** Full CRUD on exercises and comments
- **Regular Users:** Read exercises, create/edit own comments
- **Anonymous:** Read-only access to exercises

## 📱 Browser Compatibility

### Required Features
- **MediaRecorder API:** For video recording
- **getUserMedia:** For camera/microphone access
- **Modern JavaScript:** ES6+ features
- **HTML5 Video:** For video playback

### Supported Browsers
- **Chrome:** 47+ (full support)
- **Firefox:** 44+ (full support)
- **Safari:** 14.1+ (limited support)
- **Edge:** 79+ (full support)

## 🧪 Testing the System

### 1. Create Exercise (Admin)
1. Login as admin at `/admin/`
2. Go to `/create/`
3. Fill form and upload video
4. Submit to create exercise

### 2. View Exercises (Any User)
1. Visit `/` (main page)
2. See all exercises with videos
3. Click on exercise for detailed view

### 3. Add Video Comment (Authenticated User)
1. Login as regular user at `/login/`
2. Go to any exercise
3. Use webcam to record comment
4. Add optional text and submit

### 4. Reply to Comments (Any Authenticated User)
1. Click "Reply with Video" on any comment
2. Record video reply
3. Submit to create nested comment

## 🚨 Known Limitations

### Video Recording
- **Safari:** Limited MediaRecorder support
- **Mobile:** May require HTTPS for camera access
- **File Size:** Large videos may take time to upload

### Browser Support
- **IE:** No MediaRecorder support
- **Old Mobile:** Limited ES6+ support
- **Corporate Networks:** May block camera/microphone

## 🔧 Troubleshooting

### Camera Not Working
1. Check browser permissions
2. Ensure HTTPS in production
3. Try different browser
4. Check camera availability

### Video Upload Fails
1. Check file size (max 100MB)
2. Verify file format (MP4/WebM/QuickTime)
3. Check network connection
4. Verify user authentication

### Page Not Loading
1. Check Django server is running
2. Verify database migrations
3. Check console for JavaScript errors
4. Verify URL routing

## 📈 Future Enhancements

### Planned Features
- **Real-time Comments:** WebSocket integration
- **Video Processing:** Thumbnail generation
- **User Profiles:** Avatar and bio support
- **Search & Filter:** Advanced exercise discovery
- **Mobile App:** React Native companion

### Technical Improvements
- **CDN Integration:** Cloud video storage
- **Video Compression:** Automatic optimization
- **Analytics:** User engagement tracking
- **Caching:** Redis-based performance
- **Testing:** Comprehensive test coverage

## 📞 Support

For issues or questions:
1. Check browser console for errors
2. Verify Django server logs
3. Test with different browsers
4. Check network tab for API calls

---

**Built with Django, HTML5, and modern JavaScript**
**Video recording powered by MediaRecorder API**
**Responsive design for all devices**
