"""
Management command to test video processing functionality
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from core.models import VideoAsset, VideoClip
from core.services.video_processor import video_processor_service
from core.services.video_clip_service import video_clip_service


class Command(BaseCommand):
    help = 'Test video processing functionality'

    def add_arguments(self, parser):
        parser.add_argument(
            '--video-id',
            type=str,
            help='Video asset ID to test with',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Testing video processing functionality...'))
        
        # Check if we have any video assets
        video_count = VideoAsset.objects.count()
        self.stdout.write(f'Found {video_count} video assets in database')
        
        if video_count == 0:
            self.stdout.write(self.style.WARNING('No video assets found. Please upload a video first.'))
            return
        
        # Get a video asset to test with
        if options['video_id']:
            try:
                video_asset = VideoAsset.objects.get(id=options['video_id'])
            except VideoAsset.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'Video asset {options["video_id"]} not found'))
                return
        else:
            video_asset = VideoAsset.objects.first()
        
        self.stdout.write(f'Testing with video: {video_asset.orig_filename} ({video_asset.id})')
        
        # Test video metadata extraction
        self.stdout.write('Testing video metadata extraction...')
        metadata = video_processor_service.get_video_metadata(video_asset)
        if metadata:
            self.stdout.write(f'Video metadata: {metadata}')
        else:
            self.stdout.write(self.style.WARNING('Could not extract video metadata'))
        
        # Test clip hash generation
        self.stdout.write('Testing clip hash generation...')
        start_time = 10.0
        end_time = 20.0
        clip_hash = video_processor_service.generate_clip_hash(video_asset, start_time, end_time)
        self.stdout.write(f'Generated clip hash: {clip_hash}')
        
        # Test clip creation (without actual processing)
        self.stdout.write('Testing clip creation...')
        try:
            # Check if clip already exists
            existing_clip = VideoClip.objects.filter(clip_hash=clip_hash).first()
            if existing_clip:
                self.stdout.write(f'Found existing clip: {existing_clip.id}')
            else:
                # Create clip record without processing
                clip = VideoClip.objects.create(
                    original_video=video_asset,
                    clip_hash=clip_hash,
                    start_time=start_time,
                    end_time=end_time,
                    duration=end_time - start_time,
                    processing_status='pending'
                )
                self.stdout.write(f'Created clip record: {clip.id}')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Failed to create clip: {e}'))
        
        # Test clip service
        self.stdout.write('Testing video clip service...')
        try:
            clip = video_clip_service.get_clips_for_video(video_asset)
            self.stdout.write(f'Found {len(clip)} clips for video')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Failed to get clips: {e}'))
        
        self.stdout.write(self.style.SUCCESS('Video processing test completed!'))
