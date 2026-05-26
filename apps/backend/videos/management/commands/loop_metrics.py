import json

from django.core.management.base import BaseCommand

from videos.services.loop_metrics import build_loop_metrics


class Command(BaseCommand):
    help = 'Summarize member loop metrics: proofs, return windows, Today views, and playback rates.'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=30, help='Lookback window in days (default: 30).')
        parser.add_argument('--user', type=str, default='', help='Optional username filter.')
        parser.add_argument('--json', action='store_true', help='Print JSON instead of a table.')

    def handle(self, *args, **options):
        days = max(1, int(options.get('days') or 30))
        username = str(options.get('user') or '').strip()
        rows = build_loop_metrics(days=days, username=username)

        if options.get('json'):
            self.stdout.write(json.dumps({'days': days, 'rows': rows}, indent=2))
            return

        if not rows:
            self.stdout.write(self.style.WARNING(f'No loop metrics found for the last {days} days.'))
            return

        headers = [
            ('member', 18),
            ('proofs', 6),
            ('days', 5),
            ('last7', 5),
            ('d1', 3),
            ('d7', 3),
            ('play%', 6),
            ('today7', 7),
        ]
        self.stdout.write(f'Loop metrics (last {days} days)')
        self.stdout.write(' '.join(label.ljust(width) for label, width in headers))
        self.stdout.write('-' * 72)

        for row in rows:
            member = (row.get('display_name') or row.get('username') or '')[:18]
            d1 = 'Y' if row.get('returned_d1') else 'N'
            d7 = 'Y' if row.get('returned_d7') else '-'
            play_rate = row.get('playback_rate')
            play_label = f'{play_rate}%' if play_rate is not None else '-'
            self.stdout.write(
                f'{member.ljust(18)}'
                f'{str(row.get("proof_count", 0)).ljust(6)}'
                f'{str(row.get("unique_proof_days", 0)).ljust(5)}'
                f'{str(row.get("proofs_last_7d", 0)).ljust(5)}'
                f'{d1.ljust(3)}'
                f'{d7.ljust(3)}'
                f'{play_label.ljust(6)}'
                f'{str(row.get("today_views_last_7d", 0)).ljust(7)}'
            )
