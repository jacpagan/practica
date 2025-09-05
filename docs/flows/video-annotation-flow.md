# Video Annotation Flow

## Core Annotation Flow

```mermaid
flowchart TD
    subgraph "Exercise Creation"
        A[Teacher uploads video] --> B[System creates ExerciseVideo]
        B --> C[Set metadata & tags]
        C --> D[Publish exercise]
        D --> E[Exercise available to students]
    end

    subgraph "Personal Thread Creation"
        F[Student discovers exercise] --> G[Select exercise]
        G --> H[System creates PersonalExerciseThread]
        H --> I[Thread private to student + author]
        I --> J[Ready for annotation]
    end

    subgraph "Timestamped Comment Creation"
        K[Student plays video] --> L[Pause at specific moment]
        L --> M[Select timecode range]
        M --> N[Add comment text]
        N --> O[Add tags]
        O --> P[Submit comment]
        P --> Q[System validates timecode]
        Q --> R[Comment saved to PET]
    end
```

## Annotation Workflow States

```mermaid
stateDiagram-v2
    [*] --> ExerciseCreated : Teacher uploads video
    ExerciseCreated --> ThreadCreated : Student selects exercise
    ThreadCreated --> Watching : Student starts video
    Watching --> Paused : Student pauses at moment
    Paused --> Composing : Student starts comment
    Composing --> Validating : Submit comment
    Validating --> CommentSaved : Valid timecode & permissions
    Validating --> Error : Invalid input
    Error --> Composing : Fix and retry
    CommentSaved --> Watching : Continue video
    CommentSaved --> ThreadArchived : Student completes exercise
    ThreadArchived --> [*]
```

## Detailed Annotation Process

```mermaid
sequenceDiagram
    participant S as Student
    participant FE as Frontend
    participant API as Django API
    participant DB as PostgreSQL
    participant S3 as S3 Storage
    participant YT as YouTube

    Note over S,YT: Video Player Interaction
    S->>FE: Load video player
    FE->>API: GET /exercises/{id}
    API->>DB: Read ExerciseVideo
    DB-->>API: Video metadata
    API-->>FE: 200 + video URL
    FE-->>S: Display video player

    Note over S,YT: Timestamped Comment Creation
    S->>FE: Pause at 1:30
    S->>FE: Select range 1:25-1:35
    S->>FE: Add comment "Need help with form"
    S->>FE: Add tags ["form", "technique"]
    FE->>API: POST /comments {thread_id, t_start:85, t_end:95, body, tags}
    API->>DB: Validate PET ownership
    API->>DB: Check timecode bounds
    API->>DB: Insert VideoComment
    DB-->>API: Comment ID
    API-->>FE: 201 Comment created
    FE-->>S: Comment added to timeline
```

## Teacher Feedback Process

```mermaid
sequenceDiagram
    participant T as Teacher
    participant FE as Frontend
    participant API as Django API
    participant DB as PostgreSQL
    participant S as Student

    Note over T,S: Thread Review
    T->>FE: View student threads
    FE->>API: GET /threads?exercise_video_id={id}
    API->>DB: Query PersonalExerciseThread
    DB-->>API: Thread list
    API-->>FE: 200 Thread data
    FE-->>T: Display student threads

    Note over T,S: Feedback Creation
    T->>FE: Open student thread
    FE->>API: GET /threads/{id}/comments
    API->>DB: Query VideoComment
    DB-->>API: Comment list
    API-->>FE: 200 Comments
    FE-->>T: Show timestamped comments

    Note over T,S: Timestamped Response
    T->>FE: Watch video with comments
    T->>FE: Add feedback at 1:32
    FE->>API: POST /comments {thread_id, t_start:92, t_end:97, body: "Keep your back straight"}
    API->>DB: Validate teacher permissions
    API->>DB: Insert VideoComment
    DB-->>API: Comment ID
    API-->>FE: 201 Feedback created
    FE-->>T: Feedback added

    Note over T,S: Student Notification
    API->>S: Notify of new feedback
    S->>FE: Check for updates
    FE->>API: GET /threads/{id}/comments?since={timestamp}
    API->>DB: Query new comments
    DB-->>API: New comments
    API-->>FE: 200 New feedback
    FE-->>S: Display teacher feedback
```

## Annotation Types & Categories

```mermaid
graph LR
    subgraph "Student Annotations"
        SA1[Questions<br/>"How do I...?"]
        SA2[Confusion<br/>"I don't understand..."]
        SA3[Progress<br/>"I think I got it!"]
        SA4[Practice<br/>"Working on this part"]
    end

    subgraph "Teacher Annotations"
        TA1[Correction<br/>"Fix your form here"]
        TA2[Encouragement<br/>"Great progress!"]
        TA3[Explanation<br/>"This works because..."]
        TA4[Next Steps<br/>"Now try..."]
    end

    subgraph "Annotation Categories"
        AC1[Form & Technique]
        AC2[Timing & Rhythm]
        AC3[Strength & Power]
        AC4[Flexibility & Range]
        AC5[Safety & Injury Prevention]
    end

    SA1 --> AC1
    SA2 --> AC2
    SA3 --> AC3
    SA4 --> AC4
    TA1 --> AC1
    TA2 --> AC3
    TA3 --> AC2
    TA4 --> AC5
```

## Permission & Access Control

```mermaid
flowchart TD
    subgraph "Comment Creation Permissions"
        P1[Student owns PET] --> P2[Can create comments]
        P3[Exercise author] --> P4[Can respond in any PET]
        P5[Other users] --> P6[No comment access]
    end

    subgraph "Timecode Validation"
        T1[t_start >= 0] --> T2[Valid start time]
        T2 --> T3[t_end <= video_duration]
        T3 --> T4[t_end >= t_start]
        T4 --> T5[Valid time range]
    end

    subgraph "Content Validation"
        C1[Comment body not empty] --> C2[Valid content]
        C2 --> C3[Tags within limits]
        C3 --> C4[No prohibited content]
        C4 --> C5[Content approved]
    end

    P2 --> T1
    P4 --> T1
    P6 --> T6[Access denied]
    T5 --> C1
    C5 --> T7[Comment saved]
```

## Annotation Quality Metrics

```mermaid
graph TB
    subgraph "Student Quality"
        SQ1[Timecode accuracy]
        SQ2[Comment specificity]
        SQ3[Question clarity]
        SQ4[Progress tracking]
    end

    subgraph "Teacher Quality"
        TQ1[Response timeliness]
        TQ2[Feedback specificity]
        TQ3[Instruction clarity]
        TQ4[Encouragement balance]
    end

    subgraph "Platform Quality"
        PQ1[Video playback smoothness]
        PQ2[Timecode precision]
        PQ3[Comment threading]
        PQ4[Notification reliability]
    end

    SQ1 --> PQ1
    SQ2 --> PQ2
    SQ3 --> PQ3
    SQ4 --> PQ4
    TQ1 --> PQ1
    TQ2 --> PQ2
    TQ3 --> PQ3
    TQ4 --> PQ4
```

## Real-time Collaboration Features

```mermaid
graph LR
    subgraph "Live Indicators"
        LI1[Student typing indicator]
        LI2[Teacher online status]
        LI3[Thread activity badge]
        LI4[New comment notifications]
    end

    subgraph "Synchronization"
        SY1[Real-time comment updates]
        SY2[Video timestamp sync]
        SY3[Thread state consistency]
        SY4[Cross-device sync]
    end

    subgraph "Collaboration Tools"
        CT1[Comment threading]
        CT2[Tag-based organization]
        CT3[Progress tracking]
        CT4[Achievement badges]
    end

    LI1 --> SY1
    LI2 --> SY2
    LI3 --> SY3
    LI4 --> SY4
    SY1 --> CT1
    SY2 --> CT2
    SY3 --> CT3
    SY4 --> CT4
```

## Success Criteria

```mermaid
flowchart TD
    subgraph "Student Success"
        SS1[Can create accurate timecodes]
        SS2[Receives helpful teacher feedback]
        SS3[Shows learning progress]
        SS4[Engages regularly with threads]
    end

    subgraph "Teacher Success"
        TS1[Can provide targeted feedback]
        TS2[Efficiently manages multiple threads]
        TS3[Tracks student progress effectively]
        TS4[Maintains high response quality]
    end

    subgraph "Platform Success"
        PS1[Maintains data isolation]
        PS2[Ensures timecode accuracy]
        PS3[Provides smooth video experience]
        PS4[Scales with user growth]
    end

    SS1 --> PS1
    SS2 --> PS2
    SS3 --> PS3
    SS4 --> PS4
    TS1 --> PS1
    TS2 --> PS2
    TS3 --> PS3
    TS4 --> PS4
```
