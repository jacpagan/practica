# Practica - Personal Practice Tracking System

A containerized Django + React application for tracking personal practice sessions with video uploads.

## 🎯 Features

- **Exercise Video Management**: Upload and organize 60-minute drum lessons
- **Practice Session Tracking**: Record and link 10-minute practice sessions
- **Progress Visualization**: Track practice frequency and improvement
- **AWS Integration**: Cost-effective cloud storage and deployment

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- AWS CLI (for cloud deployment)
- Terraform (for infrastructure)

### Local Development

1. **Clone and setup**:
   ```bash
   git clone <your-repo>
   cd practica
   cp env.example .env
   # Edit .env with your configuration
   ```

2. **Start with Docker**:
   ```bash
   docker-compose up -d
   ```

3. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - Django Admin: http://localhost:8000/admin/

### AWS Deployment (Idempotent)

1. **Setup AWS credentials**:
   ```bash
   aws configure
   ```

2. **Check current status**:
   ```bash
   ./status-aws.sh
   ```

3. **Deploy infrastructure** (safe to run multiple times):
   ```bash
   ./deploy-aws.sh
   ```

4. **Clean up when done**:
   ```bash
   ./cleanup-aws.sh
   ```

### Deployment Commands

- `./setup-aws.sh` - Validate AWS setup and Terraform config
- `./deploy-aws.sh` - Deploy/update infrastructure (idempotent)
- `./status-aws.sh` - Check current infrastructure status  
- `./cleanup-aws.sh` - Destroy all AWS resources

### Deployment Strategy (Solo Mode)

- `main` is the only production deployment branch.
- Deployment contract: `feature branch -> PR -> main -> production`.
- No active staging promotion path exists in CI.
- Guardrails stay enabled: backup/smoke checks and fast rollback are part of the production flow.

## 🏗️ Architecture

### Backend (Django)
- **Framework**: Django 4.2 + Django REST Framework
- **Database**: PostgreSQL (production) / SQLite (development)
- **Cache**: Redis for performance
- **Storage**: AWS S3 for video files

### Frontend (React)
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS
- **State**: React hooks
- **API**: Axios for HTTP requests

### Infrastructure (AWS)
- **Database**: RDS PostgreSQL (db.t3.micro)
- **Storage**: S3 Standard
- **CDN**: CloudFront (PriceClass_100)
- **Cache**: ElastiCache Redis (optional)

## 💰 Cost-Saving Features

- **Database**: db.t3.micro instance (smallest available)
- **Storage**: S3 Standard (not IA or Glacier)
- **CDN**: PriceClass_100 (US, Canada, Europe only)
- **Backup**: Minimal retention (7 days)
- **Deployment**: Single AZ for development

## 🐳 Docker Services

- `db`: PostgreSQL database
- `redis`: Redis cache
- `backend`: Django API server
- `frontend`: React development server

## 📁 Project Structure

```
practica/
├── apps/
│   ├── backend/          # Django API
│   └── frontend/         # React app
├── infrastructure/       # Terraform configs
├── docker-compose.yml    # Local development
├── deploy-aws.sh         # AWS deployment script
└── requirements.txt      # Python dependencies
```

## 🔧 Development Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild containers
docker-compose build --no-cache

# Django management
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py createsuperuser
```

## 🌐 Production Deployment

1. **Deploy AWS infrastructure**:
   ```bash
   cd infrastructure
   terraform apply
   ```

2. **Update environment variables**:
   ```bash
   # Set production values in .env
   DEBUG=False
   DATABASE_URL=postgresql://...
   ```

3. **Deploy application**:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

## 📊 Monitoring

- **Health checks**: Built into Docker Compose
- **Logs**: Centralized logging with Docker
- **Metrics**: Basic Django admin monitoring
- **Cost tracking**: AWS Cost Explorer

## 🔒 Security

- **Environment variables**: Sensitive data in .env
- **CORS**: Configured for frontend domains
- **Database**: Isolated in private subnets
- **S3**: Bucket policies for access control

## 📝 License

Personal use only. This is your private practice tracking system.
