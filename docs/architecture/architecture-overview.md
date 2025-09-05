# System Architecture Overview

## Core Architecture

```mermaid
graph TB
    subgraph "Frontend Layer"
        SPA[Single Page App<br/>React/Vue.js]
        VP[Video Player<br/>YouTube + S3]
        UI[UI Components<br/>Threads, Comments]
    end

    subgraph "API Layer"
        API[Django REST API<br/>Personal Exercise Threads]
        AUTH[Authentication<br/>JWT + Permissions]
        VALID[Validation<br/>Timecode + ACL]
    end

    subgraph "Data Layer"
        DB[(PostgreSQL<br/>PET + VideoComments)]
        S3[S3 Storage<br/>Exercise Videos]
        CACHE[Redis Cache<br/>Session + Metadata]
    end

    subgraph "External Services"
        YT[YouTube oEmbed<br/>Metadata Fetch]
        CF[CloudFront<br/>CDN + SSL]
        ALB[Load Balancer<br/>ECS Fargate]
    end

    SPA --> API
    VP --> YT
    VP --> S3
    API --> DB
    API --> S3
    API --> CACHE
    CF --> ALB
    ALB --> API
```

## Data Flow Architecture

```mermaid
sequenceDiagram
    participant S as Student
    participant FE as Frontend
    participant API as Django API
    participant DB as PostgreSQL
    participant S3 as S3 Storage
    participant YT as YouTube

    Note over S,YT: Exercise Discovery & Thread Creation
    S->>FE: Browse exercises
    FE->>API: GET /api/exercises
    API->>DB: Query ExerciseVideo
    DB-->>API: Exercise list
    API-->>FE: 200 + metadata
    FE-->>S: Display exercises

    Note over S,YT: Personal Thread Creation
    S->>FE: Select exercise
    FE->>API: POST /api/threads {exercise_video_id}
    API->>DB: UPSERT PersonalExerciseThread
    DB-->>API: Thread ID
    API-->>FE: 201 Thread created
    FE-->>S: Thread ready

    Note over S,YT: Video Watching & Commenting
    S->>FE: Play video + add comment
    FE->>API: POST /api/comments {thread_id, t_start, t_end, body}
    API->>DB: Validate permissions + timecode
    API->>DB: Insert VideoComment
    DB-->>API: Comment ID
    API-->>FE: 201 Comment created
    FE-->>S: Comment added
```

## Security Architecture

```mermaid
graph LR
    subgraph "Access Control"
        ACL[Personal Exercise Thread ACL]
        PET[PET Owner + Exercise Author Only]
        MOD[Moderator Actions<br/>Separate from Comments]
    end

    subgraph "Data Protection"
        ENC[Encryption at Rest<br/>RDS + S3]
        TLS[TLS 1.3<br/>API + CDN]
        WAF[WAF Rules<br/>CloudFront + ALB]
    end

    subgraph "Validation Layers"
        API_VAL[API Validation<br/>Timecode + Permissions]
        DB_TRIG[Database Triggers<br/>Author Role Check]
        ORM_SCOPE[ORM Query Scopes<br/>Data Isolation]
    end

    ACL --> PET
    PET --> MOD
    API_VAL --> DB_TRIG
    DB_TRIG --> ORM_SCOPE
```

## Scalability Architecture

```mermaid
graph TB
    subgraph "Horizontal Scaling"
        ECS[ECS Fargate<br/>Auto-scaling API]
        RDS[Read Replicas<br/>Query Distribution]
        REDIS[Redis Cluster<br/>Session + Cache]
    end

    subgraph "CDN & Caching"
        CF[CloudFront<br/>Global Distribution]
        S3[S3 + CloudFront<br/>Video Delivery]
        CACHE[API Response Cache<br/>Metadata]
    end

    subgraph "Database Optimization"
        PART[Table Partitioning<br/>By date/region]
        INDEX[Composite Indexes<br/>thread_id + timecode]
        ARCH[Archival Strategy<br/>Old threads]
    end

    ECS --> RDS
    RDS --> REDIS
    CF --> S3
    S3 --> CACHE
    PART --> INDEX
    INDEX --> ARCH
```

## Monitoring & Observability

```mermaid
graph LR
    subgraph "Application Metrics"
        PET_MET[PET Creation Rate]
        COMMENT_MET[Comment Activity]
        TIMECODE_MET[Timecode Validation]
    end

    subgraph "Infrastructure Monitoring"
        ECS_MON[ECS Service Health]
        RDS_MON[RDS Performance]
        S3_MON[S3 Usage + Costs]
    end

    subgraph "Security Monitoring"
        ACL_AUDIT[Access Control Logs]
        PERM_AUDIT[Permission Violations]
        WAF_ALERTS[WAF Block Events]
    end

    PET_MET --> ECS_MON
    COMMENT_MET --> RDS_MON
    TIMECODE_MET --> S3_MON
    ACL_AUDIT --> PERM_AUDIT
    PERM_AUDIT --> WAF_ALERTS
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "CI/CD Pipeline"
        GITHUB[GitHub Actions<br/>Trunk-based Development]
        TEST[Automated Tests<br/>Unit + Integration]
        DEPLOY[ECS Deployment<br/>Blue-Green]
    end

    subgraph "Infrastructure"
        TERRAFORM[Infrastructure as Code<br/>Terraform]
        ECS[ECS Fargate<br/>API Services]
        RDS[Aurora PostgreSQL<br/>Multi-AZ]
    end

    subgraph "Monitoring"
        CLOUDWATCH[CloudWatch<br/>Logs + Metrics]
        ALARMS[Auto-scaling Alarms<br/>Performance]
        ROLLBACK[Auto-rollback<br/>5xx Spike Detection]
    end

    GITHUB --> TEST
    TEST --> DEPLOY
    DEPLOY --> ECS
    ECS --> RDS
    CLOUDWATCH --> ALARMS
    ALARMS --> ROLLBACK
```

## Key Design Principles

```mermaid
mindmap
  root((Personal Exercise Threads))
    Data Isolation
      One PET per (user, exercise)
      Private to student + author
      No cross-thread contamination
    Timecode Anchoring
      All comments timestamped
      Video-specific references
      No detached discussions
    Access Control
      Student owns their PET
      Author can respond anywhere
      Moderation separate role
    Scalability
      Horizontal scaling
      CDN distribution
      Database optimization
    Security
      Multi-layer validation
      Encryption at rest/transit
      WAF protection
```
