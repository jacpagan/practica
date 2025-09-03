# Practika - Movement Training Platform

A comprehensive platform for movement training with video annotation, playlist creation, and progress tracking.

## 🏗️ Architecture

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Django REST API + PostgreSQL
- **Infrastructure**: AWS (ECS, RDS, S3, CloudFront)
- **Documentation**: Live at [https://practika.docs.jpagan.com](https://practika.docs.jpagan.com)

## 📁 Project Structure

```
practika/
├── apps/
│   ├── backend/          # Django backend application
│   └── frontend/         # React frontend application
├── aws-tools/            # AWS cost analysis and cleanup tools
├── config/               # Configuration files
├── docs/                 # Documentation source files
├── docs-site/            # Live documentation site
└── docker-compose.yml    # Development environment
```

## 🚀 Quick Start

### Development
```bash
# Start development environment
docker-compose up

# Backend development
cd apps/backend
python manage.py runserver

# Frontend development
cd apps/frontend
npm run dev
```

### Documentation
Visit [https://practika.docs.jpagan.com](https://practika.docs.jpagan.com) for:
- Interactive architecture diagrams
- User journey flows
- Database schema
- API documentation

## 🛠️ AWS Tools

```bash
cd aws-tools
./launcher.sh
```

- Cost analysis and optimization
- Resource cleanup
- Infrastructure monitoring

## 📚 Documentation

- **Architecture**: System overview and AWS infrastructure
- **User Flows**: Video annotation and playlist creation
- **Database**: ERD and schema documentation
- **API**: OpenAPI specification

## 🏛️ Core Features

- **Video Upload & Annotation**: Upload movement videos and add timestamped annotations
- **Playlist Creation**: Create workout playlists with custom exercises
- **Progress Tracking**: Monitor training progress and achievements
- **User Management**: Authentication and profile management
- **Social Features**: Share playlists and follow other users

## 🔧 Technology Stack

- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Django, Django REST Framework, PostgreSQL
- **Infrastructure**: AWS ECS, RDS, S3, CloudFront, Route53
- **DevOps**: Docker, GitHub Actions, AWS CLI

---

*Built with ❤️ for the movement training community*
