"""
Cloud storage service for Heroku deployment
Uses AWS S3 for persistent video storage
"""
import os
import logging
from pathlib import Path
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

class CloudStorageService:
    """Service for handling cloud storage operations"""
    
    def __init__(self):
        self.s3_client = None
        self.bucket_name = os.environ.get('AWS_STORAGE_BUCKET_NAME')
        self.region = os.environ.get('AWS_S3_REGION_NAME', 'us-east-1')
        
        if self.bucket_name:
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
                aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY'),
                region_name=self.region
            )
            logger.info(f"CloudStorageService initialized with S3 bucket: {self.bucket_name}")
        else:
            logger.warning("CloudStorageService: No S3 bucket configured, falling back to local storage")
    
    def store_video(self, video_file, filename, user=None):
        """Store video file in cloud storage"""
        try:
            if self.s3_client and self.bucket_name:
                # Store in S3
                key = f"videos/{filename}"
                self.s3_client.upload_fileobj(
                    video_file,
                    self.bucket_name,
                    key,
                    ExtraArgs={
                        'ContentType': 'video/webm',
                        'ACL': 'public-read'
                    }
                )
                
                # Generate public URL
                url = f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{key}"
                logger.info(f"Video stored in S3: {url}")
                return url
            else:
                # Fallback to local storage
                path = default_storage.save(f"videos/{filename}", video_file)
                url = default_storage.url(path)
                logger.info(f"Video stored locally: {url}")
                return url
                
        except Exception as e:
            logger.error(f"Error storing video: {e}")
            raise
    
    def get_video_url(self, filename):
        """Get public URL for video file"""
        try:
            if self.s3_client and self.bucket_name:
                key = f"videos/{filename}"
                return f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{key}"
            else:
                # Fallback to local storage
                path = f"videos/{filename}"
                return default_storage.url(path)
        except Exception as e:
            logger.error(f"Error getting video URL: {e}")
            return None
    
    def delete_video(self, filename):
        """Delete video file from cloud storage"""
        try:
            if self.s3_client and self.bucket_name:
                key = f"videos/{filename}"
                self.s3_client.delete_object(Bucket=self.bucket_name, Key=key)
                logger.info(f"Video deleted from S3: {key}")
            else:
                # Fallback to local storage
                path = f"videos/{filename}"
                default_storage.delete(path)
                logger.info(f"Video deleted locally: {path}")
        except Exception as e:
            logger.error(f"Error deleting video: {e}")
            raise
