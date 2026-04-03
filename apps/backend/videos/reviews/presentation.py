from rest_framework import status
from rest_framework.response import Response

from videos.serializers import UserSummarySerializer


def review_request_forbidden_response(message='You do not have access to this feedback request.'):
    return Response(
        {
            'error': message,
            'code': 'review_request_forbidden',
        },
        status=status.HTTP_403_FORBIDDEN,
    )


def public_review_request_preview(review_request):
    if not review_request:
        return None
    return {
        'id': review_request.id,
        'status': review_request.status,
        'instrument': review_request.instrument,
        'goal': review_request.goal,
        'owner': UserSummarySerializer(review_request.student).data,
        'reviewer': UserSummarySerializer(review_request.reviewer).data,
        'owner_id': review_request.student_id,
        'reviewer_id': review_request.reviewer_id,
    }
