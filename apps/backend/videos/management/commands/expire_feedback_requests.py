from django.core.management.base import BaseCommand
from django.utils import timezone

from videos.models import FeedbackRequest, FeedbackAssignment


class Command(BaseCommand):
    help = "Expire overdue open feedback requests and claimed assignments."

    def handle(self, *args, **options):
        now = timezone.now()
        overdue = FeedbackRequest.objects.filter(
            status=FeedbackRequest.STATUS_OPEN,
            due_at__lt=now,
        )
        overdue_ids = list(overdue.values_list('id', flat=True))
        if not overdue_ids:
            self.stdout.write("No overdue feedback requests.")
            return

        expired_requests = overdue.update(
            status=FeedbackRequest.STATUS_EXPIRED,
            resolved_at=now,
        )
        expired_assignments = FeedbackAssignment.objects.filter(
            feedback_request_id__in=overdue_ids,
            status=FeedbackAssignment.STATUS_CLAIMED,
        ).update(status=FeedbackAssignment.STATUS_EXPIRED)

        self.stdout.write(
            f"Expired {expired_requests} request(s) and {expired_assignments} assignment(s)."
        )
