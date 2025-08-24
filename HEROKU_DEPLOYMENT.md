# 🚀 Heroku Deployment Guide

## Quick Deploy (What the VC Wants)

### Step 1: Install Heroku CLI
```bash
brew install heroku/brew/heroku
```

### Step 2: Login to Heroku
```bash
heroku login
```

### Step 3: Create Heroku App
```bash
heroku create your-practika-app-name
```

### Step 4: Add Database & Redis
```bash
heroku addons:create heroku-postgresql:mini
heroku addons:create heroku-redis:mini
```

### Step 5: Deploy
```bash
git init
git add .
git commit -m "Initial commit"
git push heroku main
```

### Step 6: Setup Database
```bash
heroku run python manage.py migrate
heroku run python manage.py createsuperuser
```

## Your App Will Be Live At:
**https://your-practika-app-name.herokuapp.com**

## Default Users:
- **Admin**: admin / admin123
- **User**: user / user123

## What This Gives You:
✅ Live URL for the VC to see
✅ Real users can access your app
✅ Production database
✅ HTTPS automatically
✅ Auto-scaling
✅ Professional hosting

## Next Steps After Deploy:
1. Share the URL with potential users
2. Get feedback on real usage
3. Iterate based on user needs
4. Start building the "wow" features

