-- Practika Database Schema
-- Entity Relationship Diagram (ERD)

-- Users table - extends Django's built-in User model
CREATE TABLE auth_user (
    id SERIAL PRIMARY KEY,
    username VARCHAR(150) UNIQUE NOT NULL,
    email VARCHAR(254) UNIQUE NOT NULL,
    password VARCHAR(128) NOT NULL,
    first_name VARCHAR(150),
    last_name VARCHAR(150),
    is_active BOOLEAN DEFAULT TRUE,
    is_staff BOOLEAN DEFAULT FALSE,
    is_superuser BOOLEAN DEFAULT FALSE,
    date_joined TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- User profiles with additional information
CREATE TABLE users_profile (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES auth_user(id) ON DELETE CASCADE,
    bio TEXT,
    profile_picture VARCHAR(255),
    date_of_birth DATE,
    height_cm INTEGER,
    weight_kg DECIMAL(5,2),
    fitness_level VARCHAR(20) CHECK (fitness_level IN ('beginner', 'intermediate', 'advanced')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Exercise categories
CREATE TABLE exercises_category (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(7), -- HEX color code
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Exercises table
CREATE TABLE exercises_exercise (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES exercises_category(id) ON DELETE SET NULL,
    difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    equipment_needed TEXT[],
    muscle_groups TEXT[],
    instructions TEXT,
    tips TEXT,
    created_by INTEGER REFERENCES auth_user(id) ON DELETE SET NULL,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Exercise videos
CREATE TABLE exercises_exercisevideo (
    id SERIAL PRIMARY KEY,
    exercise_id INTEGER REFERENCES exercises_exercise(id) ON DELETE CASCADE,
    video_file VARCHAR(255) NOT NULL,
    thumbnail VARCHAR(255),
    duration_seconds INTEGER,
    file_size_bytes BIGINT,
    s3_key VARCHAR(500),
    created_by INTEGER REFERENCES auth_user(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Exercise tags
CREATE TABLE exercises_tag (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Exercise-tag relationships (many-to-many)
CREATE TABLE exercises_exercise_tags (
    id SERIAL PRIMARY KEY,
    exercise_id INTEGER REFERENCES exercises_exercise(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES exercises_tag(id) ON DELETE CASCADE
);

-- User workouts
CREATE TABLE workouts_workout (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES auth_user(id) ON DELETE CASCADE,
    title VARCHAR(200),
    notes TEXT,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    total_duration_minutes INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workout exercises (many-to-many relationship)
CREATE TABLE workouts_workoutexercise (
    id SERIAL PRIMARY KEY,
    workout_id INTEGER REFERENCES workouts_workout(id) ON DELETE CASCADE,
    exercise_id INTEGER REFERENCES exercises_exercise(id) ON DELETE CASCADE,
    sets INTEGER DEFAULT 1,
    reps INTEGER,
    duration_seconds INTEGER,
    weight_kg DECIMAL(5,2),
    order_index INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Video annotations
CREATE TABLE annotations_videoannotation (
    id SERIAL PRIMARY KEY,
    exercise_video_id INTEGER REFERENCES exercises_exercisevideo(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES auth_user(id) ON DELETE CASCADE,
    annotation_type VARCHAR(50) NOT NULL,
    timestamp_start DECIMAL(10,3),
    timestamp_end DECIMAL(10,3),
    content TEXT NOT NULL,
    coordinates JSONB,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User favorites
CREATE TABLE users_userfavorite (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES auth_user(id) ON DELETE CASCADE,
    exercise_id INTEGER REFERENCES exercises_exercise(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_exercises_exercise_category ON exercises_exercise(category_id);
CREATE INDEX idx_exercises_exercisevideo_exercise ON exercises_exercisevideo(exercise_id);
CREATE INDEX idx_workouts_workout_user ON workouts_workout(user_id);
CREATE INDEX idx_workouts_workoutexercise_workout ON workouts_workoutexercise(workout_id);
CREATE INDEX idx_workouts_workoutexercise_exercise ON workouts_workoutexercise(exercise_id);
CREATE INDEX idx_annotations_videoannotation_video ON annotations_videoannotation(exercise_video_id);
CREATE INDEX idx_annotations_videoannotation_user ON annotations_videoannotation(user_id);
CREATE INDEX idx_users_userfavorite_user ON users_userfavorite(user_id);
CREATE INDEX idx_users_userfavorite_exercise ON users_userfavorite(exercise_id);

-- Sample data
INSERT INTO exercises_category (name, description, icon, color) VALUES
('Strength', 'Build muscle and increase strength', 'dumbbell', '#FF6B6B'),
('Cardio', 'Improve cardiovascular fitness', 'heart', '#4ECDC4'),
('Flexibility', 'Improve range of motion and flexibility', 'yoga', '#45B7D1'),
('Balance', 'Enhance balance and stability', 'balance', '#96CEB4'),
('Dance', 'Rhythmic movement and expression', 'music', '#FFEAA7'),
('Martial Arts', 'Combat sports and self-defense', 'fist', '#DDA0DD'),
('Mindfulness', 'Mental focus and relaxation', 'meditation', '#98D8C8');

INSERT INTO exercises_tag (name) VALUES
('beginner'), ('intermediate'), ('advanced'),
('bodyweight'), ('dumbbells'), ('barbell'), ('kettlebell'),
('cardio'), ('strength'), ('flexibility'), ('balance'),
('dance'), ('yoga'), ('pilates'), ('boxing'), ('meditation'), ('outdoor');
