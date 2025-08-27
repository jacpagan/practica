
def track_video_view(user, video):
    from .models import VideoView
    if user.is_authenticated:
        VideoView.objects.create(user=user, video=video)


def track_comment_activity(user, comment, action):
    from .models import CommentActivity
    if user.is_authenticated:
        CommentActivity.objects.create(user=user, comment=comment, action=action)


def track_session(user, login_time, logout_time):
    from datetime import datetime
    from django.utils import timezone
    from .models import SessionStat
    if not user.is_authenticated:
        return
    if isinstance(login_time, str):
        try:
            login_time = datetime.fromisoformat(login_time)
        except ValueError:
            login_time = timezone.now()
    if timezone.is_naive(login_time):
        login_time = timezone.make_aware(login_time, timezone.get_current_timezone())
    duration = int((logout_time - login_time).total_seconds())
    SessionStat.objects.create(user=user, login_time=login_time, logout_time=logout_time, duration_seconds=duration)
