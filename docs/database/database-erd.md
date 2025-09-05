# Database Entity Relationship Diagram

## Core ERD

```mermaid
erDiagram
    %% Users & Roles
    User {
        uuid id PK
        string username UK
        string email UK
        bool is_admin
        datetime created_at
    }
    
    %% Canonical exercise video (local or YouTube)
    ExerciseVideo {
        uuid id PK
        uuid author_id FK
        string title
        string provider "enum: s3,youtube"
        string source_uri "s3://bucket/key or https://youtu.be/ID"
        string provider_video_id "nullable unless provider=youtube"
        int duration_sec
        string visibility "enum: public, link, private"
        int source_version
        datetime created_at
        datetime published_at
    }
    
    %% One thread per (user, exercise_video)
    PersonalExerciseThread {
        uuid id PK
        uuid owner_id FK
        uuid exercise_video_id FK
        string status "enum: open, archived"
        datetime created_at
        datetime last_activity_at
        UNIQUE (owner_id, exercise_video_id)
    }
    
    %% Only timestamp-anchored comments inside PET
    VideoComment {
        uuid id PK
        uuid thread_id FK
        uuid exercise_video_id FK
        uuid author_id FK
        int t_start_sec
        int t_end_sec
        string[] tags
        text body_md
        string role "enum: owner, exercise_author"
        datetime created_at
        datetime updated_at
    }
    
    %% Optional tagging for analytics/search
    Tag {
        uuid id PK
        string slug UK
        string label
    }
    
    VideoComment_Tag {
        uuid id PK
        uuid comment_id FK
        uuid tag_id FK
        UNIQUE (comment_id, tag_id)
    }

    %% Relationships
    User ||--o{ ExerciseVideo : "authors"
    User ||--o{ PersonalExerciseThread : "owns"
    ExerciseVideo ||--o{ PersonalExerciseThread : "is threaded by"
    PersonalExerciseThread ||--o{ VideoComment : "contains"
    ExerciseVideo ||--o{ VideoComment : "anchors"
    User ||--o{ VideoComment : "writes"
    VideoComment ||--o{ VideoComment_Tag : "has"
    Tag ||--o{ VideoComment_Tag : "labels"
```

## Access Control Model

```mermaid
flowchart LR
    subgraph Actors
        A[Student (PET Owner)]
        B[Exercise Author (OP)]
        C[Other Users]
        D[Admin/Mod]
    end

    subgraph Objects
        EV[ExerciseVideo]
        PET[PersonalExerciseThread]
        VC[VideoComment]
    end

    %% Permissions legend: R=Read, W=Write, X=Moderate/Delete
    A --- EV:::r
    A --- PET:::rw
    A --- VC:::rw

    B --- EV:::r
    B --- PET:::rw
    B --- VC:::rw

    C --- EV:::r
    C --- PET:::deny
    C --- VC:::deny

    D --- EV:::rx
    D --- PET:::rx
    D --- VC:::rx

    classDef r fill:#e8f5ff,stroke:#1e88e5,stroke-width:1px;
    classDef rw fill:#e8ffe8,stroke:#43a047,stroke-width:1px;
    classDef rx fill:#fff3e0,stroke:#fb8c00,stroke-width:1px;
    classDef deny fill:#ffebee,stroke:#e53935,stroke-width:1px;
```

## Comment Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Draft : client composes\n(t_start,t_end,tags,body)
    Draft --> Validate : POST /api/comments/validate
    Validate --> Rejected : 400 invalid timecode/ACL
    Validate --> Persisted : 201 created
    Persisted --> Edited : PATCH by same author
    Edited --> Persisted
    Persisted --> Deleted : DELETE by author OR moderator
    Deleted --> [*]
```

## Database Constraints

```mermaid
flowchart TB
    subgraph Constraints
        C1["UNIQUE (owner_id, exercise_video_id) on PersonalExerciseThread"]
        C2["FK VideoComment.thread_id -> PET.id ON DELETE CASCADE"]
        C3["FK VideoComment.exercise_video_id -> ExerciseVideo.id"]
        C4["CHECK (t_start_sec >= 0 AND t_end_sec >= t_start_sec)"]
        C5["CHECK (role IN ('owner','exercise_author'))"]
        C6["DEFERRABLE TRIGGER: comment.author must be PET.owner OR Exercise.author"]
        C7["CHECK (provider IN ('s3','youtube'))"]
        C8["CHECK (provider='youtube' => provider_video_id IS NOT NULL)"]
    end
```

## Key Business Rules

```mermaid
graph LR
    subgraph "Thread Rules"
        TR1[One PET per user/exercise]
        TR2[PET owner can write comments]
        TR3[Exercise author can respond anywhere]
        TR4[No other users can comment]
    end

    subgraph "Comment Rules"
        CR1[All comments must be timestamped]
        CR2[Timecode must be within video duration]
        CR3[Comments must belong to valid PET]
        CR4[Author must be PET owner or exercise author]
    end

    subgraph "Video Rules"
        VR1[ExerciseVideo is immutable identity]
        VR2[Versions allowed via source_version]
        VR3[YouTube videos normalized by provider_video_id]
        VR4[Local videos stored in S3 with ACL]
    end

    TR1 --> CR1
    TR2 --> CR2
    TR3 --> CR3
    TR4 --> CR4
    CR1 --> VR1
    CR2 --> VR2
    CR3 --> VR3
    CR4 --> VR4
```

## Performance Considerations

```mermaid
graph TB
    subgraph "Indexing Strategy"
        IDX1["INDEX (owner_id, exercise_video_id) on PET"]
        IDX2["INDEX (thread_id, created_at) on VideoComment"]
        IDX3["INDEX (exercise_video_id, t_start_sec) on VideoComment"]
        IDX4["INDEX (author_id, role) on VideoComment"]
    end

    subgraph "Query Optimization"
        QO1[Composite indexes for common queries]
        QO2[Partial indexes for active threads]
        QO3[Covering indexes for metadata]
        QO4[Partitioning by date for large tables]
    end

    subgraph "Caching Strategy"
        CS1[Redis cache for user sessions]
        CS2[CDN for video content]
        CS3[Application cache for metadata]
        CS4[Database query result cache]
    end

    IDX1 --> QO1
    IDX2 --> QO2
    IDX3 --> QO3
    IDX4 --> QO4
    QO1 --> CS1
    QO2 --> CS2
    QO3 --> CS3
    QO4 --> CS4
```

## Security Features

```mermaid
graph LR
    subgraph "Data Protection"
        DP1[Encryption at rest (RDS)]
        DP2[Encryption in transit (TLS 1.3)]
        DP3[S3 bucket encryption]
        DP4[Column-level encryption for sensitive data]
    end

    subgraph "Access Control"
        AC1[Row-level security (RLS)]
        AC2[Database triggers for authorization]
        AC3[ORM query scopes]
        AC4[API-level permission checks]
    end

    subgraph "Audit & Monitoring"
        AM1[Comprehensive audit logs]
        AM2[Permission violation alerts]
        AM3[Data access monitoring]
        AM4[Compliance reporting]
    end

    DP1 --> AC1
    DP2 --> AC2
    DP3 --> AC3
    DP4 --> AC4
    AC1 --> AM1
    AC2 --> AM2
    AC3 --> AM3
    AC4 --> AM4
```
