# Practika Beta - Movement Video Annotation Platform

A simple movement application that allows users to upload, view, and annotate movement videos with form corrections and technique tips.

## 🏗️ Architecture

```
Practika/
├── apps/
│   ├── backend/           # Django REST API
│   └── frontend/          # React + Vite frontend
├── docs/                  # Documentation
├── config/
│   └── envs/              # Environment configurations
└── .github/
    └── workflows/         # CI/CD pipelines
```

## 🛠️ Technology Stack

### Backend & API
- **Django 4.2.7**: Web framework with REST API
- **Django REST Framework**: API development and serialization
- **PostgreSQL**: Primary database
- **JWT Authentication**: Secure token-based authentication
- **AWS S3**: Video storage

### Infrastructure & DevOps
- **AWS**: Cloud infrastructure (ECS, RDS, S3, CloudFront)
- **Terraform**: Infrastructure as Code
- **Docker**: Containerization
- **GitHub Actions**: CI/CD pipelines

### Frontend
- **React**: User interface framework
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- AWS CLI configured
- Node.js >= 18
- Python >= 3.11

### Local Development

1. **Clone and setup:**
   ```bash
   git clone <repository-url>
   cd Practika
   make dev-up
   ```

2. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - Admin: http://localhost:8000/admin

3. **Run tests:**
   ```bash
   make test
   make lint
   ```

## 📋 Features

### Core Functionality
- **User Authentication**: JWT-based auth
- **Exercise Management**: Create and edit exercises
- **Video Upload**: Basic S3 uploads
- **Video Annotations**: Add form corrections and tips
- **Workout Tracking**: Simple workout management

## 🏛️ Infrastructure

### AWS Services Used
- **ECS Fargate**: Containerized services
- **RDS PostgreSQL**: Database
- **S3**: Video storage and static hosting
- **CloudFront**: CDN for content delivery

### Environment Configuration
- **Development**: Local Docker setup
- **Production**: AWS deployment

## 🔧 Development

### Backend (Django)
```bash
cd apps/backend
python manage.py runserver
python manage.py test
python manage.py migrate
```

### Frontend (React)
```bash
cd apps/frontend
npm install
npm run dev
```

## 📚 API Documentation

### Authentication
```bash
# Login
POST /api/auth/login/
{
    "username": "user@example.com",
    "password": "password123"
}

# Response
{
    "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

### Exercises
```bash
# List exercises
GET /api/exercises/
Authorization: Bearer <access_token>

# Create exercise
POST /api/exercises/
{
    "title": "Squat Form",
    "description": "Basic squat technique",
    "category": "strength"
}
```

### Workouts
```bash
# List workouts
GET /api/workouts/
Authorization: Bearer <access_token>

# Create workout
POST /api/workouts/
{
    "title": "Morning Routine",
    "exercises": [1, 2, 3]
}
```

## 🚀 Deployment

### Production Deployment
```bash
# Deploy to production
make deploy
```

This will:
1. Build and push the backend Docker image
2. Build and deploy the frontend to S3
3. Update the production environment

## 📁 Project Structure

```
Practika/
├── apps/
│   ├── backend/                 # Django REST API
│   │   ├── requirements.txt     # Python dependencies
│   │   ├── Dockerfile           # Backend container
│   │   ├── practika/            # Django project settings
│   │   ├── users/               # User management
│   │   ├── exercises/           # Exercise management
│   │   ├── workouts/            # Workout management
│   │   └── annotations/         # Video annotations
│   └── frontend/                # React + Vite frontend
├── docs/                        # Documentation
│   ├── README.md                # Documentation index
│   ├── architecture-overview.md # System architecture
│   ├── aws-infrastructure.md    # AWS components
│   ├── database-erd.md         # Database relationships
│   ├── user-journey.md          # User journey map
│   ├── video-annotation-flow.md # Video annotation
│   ├── playlist-creation-flow.md # Playlist creation
│   ├── erd.sql                  # Database schema
│   └── openapi.yaml             # API specification
├── config/
│   └── envs/                    # Environment configurations
├── .github/
│   └── workflows/               # CI/CD pipelines
├── README.md                    # This file
├── Makefile                     # Development commands
├── docker-compose.yml           # Local development
└── .gitignore                   # Git ignore rules
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `make test`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support, email support@practika.com or create an issue in the repository.
