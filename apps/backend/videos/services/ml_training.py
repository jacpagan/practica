from collections import Counter
import re

from django.db.models import Prefetch

from videos.models import MLDatasetSnapshot, MLModelSuggestion, ReviewRequest, Session, VideoFeedback


ML_DATASET_SNAPSHOT_VERSION = 'ml-training-export-v1'
ML_MODEL_NAME = 'baseline-session-thread-suggester'
ML_MODEL_VERSION = 'v1'

TOKEN_RE = re.compile(r"[a-z0-9]+")
STOP_WORDS = {
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'go', 'has', 'have', 'i', 'in', 'is',
    'it', 'its', 'of', 'on', 'or', 'out', 'that', 'the', 'their', 'this', 'to', 'up', 'was', 'with', 'work',
    'your', 'into', 'over', 'more', 'less', 'new', 'next', 'take', 'thread', 'video',
}


def normalize_label(value):
    return ' '.join(str(value or '').strip().split())


def normalize_source(value):
    return str(value or '').strip()[:64]


def tokenize_text(*parts):
    tokens = set()
    for part in parts:
        text = str(part or '').lower()
        for token in TOKEN_RE.findall(text):
            if len(token) < 2 or token in STOP_WORDS:
                continue
            tokens.add(token)
    return tokens


def _session_tags(session):
    return [normalize_label(tag.name) for tag in session.tags.all() if normalize_label(tag.name)]


def _session_review_requests(session):
    return session.review_requests.all()


def session_training_row(session):
    review_requests = list(_session_review_requests(session))
    tag_names = _session_tags(session)
    feedback_category_counts = Counter()
    review_goals = []
    exercises_or_songs = []
    instruments = []
    notes = []
    seen_feedback_ids = set()

    for review_request in review_requests:
        if review_request.goal:
            review_goals.append(normalize_label(review_request.goal))
        if review_request.exercise_or_song:
            exercises_or_songs.append(normalize_label(review_request.exercise_or_song))
        if review_request.instrument:
            instruments.append(normalize_label(review_request.instrument))
        if review_request.notes:
            notes.append(normalize_label(review_request.notes))
        for feedback_item in review_request.feedback_items.all():
            seen_feedback_ids.add(feedback_item.id)
            category = normalize_label(feedback_item.feedback_category).lower()
            if category:
                feedback_category_counts[category] += 1

    for feedback_item in session.video_feedback.all():
        if feedback_item.id in seen_feedback_ids:
            continue
        category = normalize_label(feedback_item.feedback_category).lower()
        if category:
            feedback_category_counts[category] += 1
        if feedback_item.text:
            notes.append(normalize_label(feedback_item.text))

    feature_parts = [
        session.title,
        session.practice_series,
        session.description,
        session.reference_title,
        session.reference_url,
        ' '.join(tag_names),
        ' '.join(review_goals),
        ' '.join(exercises_or_songs),
        ' '.join(instruments),
        ' '.join(notes),
    ]
    feature_text = ' '.join(part for part in feature_parts if str(part or '').strip())

    return {
        'session_id': session.id,
        'owner_id': session.user_id,
        'recorded_at': session.recorded_at.isoformat() if session.recorded_at else '',
        'title': session.title,
        'practice_series': normalize_label(session.practice_series),
        'thread_label': normalize_label(session.practice_series),
        'secondary_labels': tag_names,
        'tag_names': tag_names,
        'review_goals': review_goals,
        'exercise_or_song': exercises_or_songs,
        'instruments': instruments,
        'feedback_category_counts': dict(sorted(feedback_category_counts.items())),
        'review_request_count': len(review_requests),
        'follow_up_request_count': sum(1 for review_request in review_requests if review_request.parent_request_id),
        'feature_text': feature_text,
        'feature_tokens': sorted(tokenize_text(feature_text)),
        'training_enabled': bool(session.ml_training_enabled),
        'training_consent_source': normalize_source(session.ml_training_consent_source),
        'training_consent_at': session.ml_training_consent_at.isoformat() if session.ml_training_consent_at else '',
        'training_consent_revoked_at': session.ml_training_consent_revoked_at.isoformat() if session.ml_training_consent_revoked_at else '',
        'training_consent_revocation_source': normalize_source(session.ml_training_consent_revocation_source),
    }


def build_dataset_snapshot(*, sessions, created_by=None):
    rows = [session_training_row(session) for session in sessions]
    manifest = {
        'snapshot_version': ML_DATASET_SNAPSHOT_VERSION,
        'model_task': 'thread_and_category_classification',
        'source_scope': 'opted_in_sessions',
        'feature_fields': [
            'title', 'practice_series', 'description', 'reference_title', 'reference_url',
            'tag_names', 'review_goals', 'exercise_or_song', 'instruments', 'feature_text',
        ],
        'label_fields': ['thread_label', 'secondary_labels', 'feedback_category_counts'],
        'row_count': len(rows),
    }
    snapshot = MLDatasetSnapshot.objects.create(
        snapshot_version=ML_DATASET_SNAPSHOT_VERSION,
        created_by=created_by,
        session_ids_json=[row['session_id'] for row in rows],
        manifest_json=manifest,
        row_count=len(rows),
    )
    return snapshot, rows, manifest


def _prefetched_consented_sessions_qs():
    feedback_prefetch = Prefetch(
        'feedback_items',
        queryset=VideoFeedback.objects.order_by('timestamp_seconds', 'created_at'),
    )
    review_request_prefetch = Prefetch(
        'review_requests',
        queryset=ReviewRequest.objects.select_related('reviewer', 'student').prefetch_related(feedback_prefetch).order_by('created_at'),
    )
    video_feedback_prefetch = Prefetch(
        'video_feedback',
        queryset=VideoFeedback.objects.select_related('user').order_by('timestamp_seconds', 'created_at'),
    )
    return Session.objects.filter(ml_training_enabled=True).select_related('user', 'user__profile').prefetch_related(
        'tags',
        review_request_prefetch,
        video_feedback_prefetch,
    ).exclude(practice_series='').order_by('-recorded_at')


def suggest_session_thread(session, *, limit=200):
    current_row = session_training_row(session)
    current_tokens = tokenize_text(current_row['feature_text'])
    candidates = list(
        _prefetched_consented_sessions_qs().exclude(pk=session.pk)[:limit]
    )

    scored = []
    for candidate in candidates:
        candidate_row = session_training_row(candidate)
        candidate_label = candidate_row['thread_label']
        if not candidate_label:
            continue
        candidate_tokens = tokenize_text(candidate_row['feature_text'])
        overlap = current_tokens & candidate_tokens
        if not overlap:
            continue
        score = len(overlap)
        if candidate_row['thread_label'].lower() == current_row['thread_label'].lower() and current_row['thread_label']:
            score += 1
        scored.append({
            'session_id': candidate.id,
            'thread_label': candidate_label,
            'score': score,
            'matched_tokens': sorted(list(overlap))[:8],
            'feedback_category_counts': candidate_row['feedback_category_counts'],
        })

    scored.sort(key=lambda item: (-item['score'], item['thread_label'].lower(), item['session_id']))
    if not scored:
        return {
            'model_name': ML_MODEL_NAME,
            'model_version': ML_MODEL_VERSION,
            'thread': {'label': '', 'confidence': 0.0},
            'category_predictions': [],
            'matched_sessions': [],
            'explanation': {
                'reason': 'No opted-in sessions with overlapping tokens were found.',
                'candidate_count': len(candidates),
                'current_tokens': sorted(list(current_tokens))[:16],
            },
        }

    label_scores = Counter()
    category_scores = Counter()
    for item in scored:
        label_scores[item['thread_label']] += item['score']
        for category, count in item['feedback_category_counts'].items():
            if category:
                category_scores[category] += count

    best_label, best_score = label_scores.most_common(1)[0]
    total_score = sum(label_scores.values()) or 1
    thread_confidence = round(best_score / total_score, 3)
    category_predictions = []
    for category, count in category_scores.most_common(5):
        category_predictions.append({
            'label': category,
            'confidence': round(count / max(1, sum(category_scores.values())), 3),
        })

    return {
        'model_name': ML_MODEL_NAME,
        'model_version': ML_MODEL_VERSION,
        'thread': {'label': best_label, 'confidence': thread_confidence},
        'category_predictions': category_predictions,
        'matched_sessions': scored[:5],
        'explanation': {
            'candidate_count': len(candidates),
            'current_tokens': sorted(list(current_tokens))[:16],
            'top_label_score': best_score,
            'top_label_support': label_scores[best_label],
        },
    }


def record_session_suggestion_feedback(*, session, created_by, suggestion_payload, decision, resolved_thread_label='', resolved_label_choices=None, note=''):
    resolved_label_choices = resolved_label_choices or []
    return MLModelSuggestion.objects.create(
        session=session,
        created_by=created_by,
        model_name=suggestion_payload.get('model_name', ML_MODEL_NAME),
        model_version=suggestion_payload.get('model_version', ML_MODEL_VERSION),
        predicted_thread_label=suggestion_payload.get('thread', {}).get('label', ''),
        predicted_label_choices_json=suggestion_payload.get('category_predictions', []),
        confidence_json={
            'thread': suggestion_payload.get('thread', {}),
            'categories': suggestion_payload.get('category_predictions', []),
        },
        explanation_json=suggestion_payload.get('explanation', {}),
        decision=decision,
        resolved_thread_label=normalize_label(resolved_thread_label),
        resolved_label_choices_json=[normalize_label(value) for value in resolved_label_choices if normalize_label(value)],
        note=normalize_label(note),
    )
