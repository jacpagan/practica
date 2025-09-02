# 🎯 Practika MVP

A platform for students to record and organize their practice sessions through videos.

## 🚀 Features

- **User Authentication**: JWT-based login/register system
- **Playlist Management**: Create and organize practice collections
- **Video Upload**: Upload practice videos with metadata
- **Trust Scoring**: AI-powered content verification
- **Progress Tracking**: Visual progress indicators
- **Responsive Design**: Works on all devices

## 🛠 Tech Stack

- **Backend**: Django 4.2 + Django REST Framework
- **Database**: PostgreSQL (AWS RDS)
- **Storage**: AWS S3 for video files
- **Compute**: AWS ECS Fargate
- **Load Balancer**: AWS ALB
- **Frontend**: HTML/CSS/JavaScript
- **Authentication**: JWT tokens
- **Deployment**: Docker + AWS

## 📋 Prerequisites

- Python 3.11+
- Docker
- AWS CLI configured
- PostgreSQL database
- AWS S3 bucket

## 🔧 Installation

### 1. Clone Repository
```bash
git clone <repository-url>
cd Practika
```

### 2. Environment Setup
```bash
# Copy environment template
cp env.example .env

# Edit .env with your values
nano .env
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Database Setup
```bash
python manage.py makemigrations
python manage.py migrate
```

### 5. Create Superuser
```bash
python manage.py createsuperuser
```

## 🚀 Deployment

### AWS Infrastructure Setup

1. **Create ECS Cluster**
```bash
aws ecs create-cluster --cluster-name practika-cluster
```

2. **Create IAM Roles**
```bash
# Create task execution role (see AWS documentation)
```

3. **Create RDS Database**
```bash
# Create PostgreSQL RDS instance
```

4. **Create S3 Bucket**
```bash
aws s3 mb s3://your-practika-bucket
```

5. **Build and Push Docker Image**
```bash
docker build -t practika-mvp:latest .
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
docker tag practika-mvp:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/practika-mvp:latest
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/practika-mvp:latest
```

6. **Deploy Task Definition**
```bash
# Update task-definition.template.json with your values
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

## 🔒 Security

### Environment Variables
Never commit sensitive information to Git:
- Database passwords
- AWS credentials
- Django secret keys
- JWT secrets

### AWS Best Practices
- Use IAM roles instead of access keys
- Enable CloudTrail logging
- Use VPC for database security
- Enable SSL/TLS encryption

## 📚 API Documentation

### Authentication
- `POST /api/auth/register/` - User registration
- `POST /api/token/` - JWT token login
- `GET /api/auth/profile/` - User profile

### Playlists
- `GET /api/playlists/` - List user playlists
- `POST /api/playlists/` - Create playlist
- `GET /api/playlists/{id}/` - Get playlist details
- `PUT /api/playlists/{id}/` - Update playlist

### Videos
- `POST /api/playlists/{id}/upload_video/` - Upload video
- `GET /api/videos/` - List videos
- `PUT /api/videos/{id}/` - Update video

## 🧪 Testing

```bash
# Run tests
python manage.py test

# Test API endpoints
curl -X GET https://your-domain.com/api/health/
```

## 📝 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SECRET_KEY` | Django secret key | `your-secret-key-here` |
| `DEBUG` | Debug mode | `False` |
| `ALLOWED_HOSTS` | Allowed domains | `your-domain.com` |
| `DB_NAME` | Database name | `practika` |
| `DB_USER` | Database user | `practika_admin` |
| `DB_PASSWORD` | Database password | `your-password` |
| `DB_HOST` | Database host | `your-rds-endpoint` |
| `AWS_STORAGE_BUCKET_NAME` | S3 bucket name | `practika-media` |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support, email support@practika.com or create an issue in the repository.

## 🔄 Version History

- **v1.0.0** - Initial MVP release
  - User authentication
  - Playlist management
  - Video upload
  - Trust scoring
  - Responsive UI
