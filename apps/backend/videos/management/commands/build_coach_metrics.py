from datetime import date, timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from videos.models import Space
from videos.services.coach_metrics import compute_daily_metric_for_coach, upsert_daily_metric


class Command(BaseCommand):
    help = "Build and upsert daily coach metrics for trailing windows."

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=35, help='Number of trailing days to recalculate.')
        parser.add_argument('--date', type=str, default=None, help='Anchor date in YYYY-MM-DD (UTC).')

    def handle(self, *args, **options):
        days = int(options['days'] or 0)
        if days <= 0:
            raise CommandError('--days must be a positive integer')

        anchor = self._parse_anchor_date(options.get('date'))
        minutes_saved = getattr(settings, 'COACH_METRICS_MINUTES_SAVED_PER_COMPLETION', 20)

        coach_ids = list(Space.objects.values_list('owner_id', flat=True).distinct())
        if not coach_ids:
            self.stdout.write('No coaches found (no space owners).')
            return

        start_date = anchor - timedelta(days=days - 1)
        processed = 0
        for day_offset in range(days):
            as_of_date = start_date + timedelta(days=day_offset)
            for coach_id in coach_ids:
                metric_values = compute_daily_metric_for_coach(
                    coach_id=coach_id,
                    as_of_date=as_of_date,
                    minutes_saved_per_completion=minutes_saved,
                )
                upsert_daily_metric(coach_id=coach_id, as_of_date=as_of_date, metric_values=metric_values)
                processed += 1

        self.stdout.write(
            f'Upserted {processed} coach-day rows for {len(coach_ids)} coach(es) from {start_date} to {anchor}.'
        )

    def _parse_anchor_date(self, raw_date):
        if not raw_date:
            return timezone.now().date()
        try:
            return date.fromisoformat(raw_date)
        except ValueError as exc:
            raise CommandError('--date must be in YYYY-MM-DD format') from exc
