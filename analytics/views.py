
from django.contrib.auth.decorators import user_passes_test
from django.db.models import Avg
from django.http import JsonResponse

from .models import VideoView, CommentActivity, SessionStat


@user_passes_test(lambda u: u.is_staff)
def summary(request):
    data = {
        "video_views": VideoView.objects.count(),
        "comment_events": CommentActivity.objects.count(),
        "average_session_length": SessionStat.objects.aggregate(Avg("duration_seconds"))["duration_seconds__avg"] or 0,
    }
    return JsonResponse(data)
