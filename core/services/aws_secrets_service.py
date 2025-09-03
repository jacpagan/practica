"""
AWS Secrets Manager integration service
"""

import json
import logging
import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from django.conf import settings
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class AWSSecretsService:
    """
    Service for securely retrieving secrets from AWS Secrets Manager
    """
    
    def __init__(self):
        """Initialize the Secrets Manager client"""
        self.region_name = getattr(settings, 'AWS_DEFAULT_REGION', 'us-east-1')
        self.secrets_prefix = getattr(settings, 'SECRETS_PREFIX', 'practika/production')
        
        try:
            # Use IAM role if available, fallback to credentials
            self.client = boto3.client(
                'secretsmanager',
                region_name=self.region_name
            )
            logger.info(f"AWS Secrets Manager client initialized for region: {self.region_name}")
        except Exception as e:
            logger.error(f"Failed to initialize AWS Secrets Manager client: {e}")
            self.client = None
    
    def get_secret(self, secret_name: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a secret from AWS Secrets Manager
        
        Args:
            secret_name: Name of the secret (will be prefixed with secrets_prefix)
        
        Returns:
            Dictionary containing the secret data, or None if not found
        """
        if not self.client:
            logger.error("Secrets Manager client not initialized")
            return None
        
        full_secret_name = f"{self.secrets_prefix}/{secret_name}"
        
        try:
            response = self.client.get_secret_value(SecretId=full_secret_name)
            secret_string = response.get('SecretString')
            
            if secret_string:
                return json.loads(secret_string)
            else:
                logger.warning(f"Secret {full_secret_name} has no string value")
                return None
                
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == 'ResourceNotFoundException':
                logger.warning(f"Secret {full_secret_name} not found")
            elif error_code == 'InvalidRequestException':
                logger.error(f"Invalid request for secret {full_secret_name}: {e}")
            elif error_code == 'InvalidParameterException':
                logger.error(f"Invalid parameter for secret {full_secret_name}: {e}")
            elif error_code == 'DecryptionFailureException':
                logger.error(f"Decryption failed for secret {full_secret_name}: {e}")
            elif error_code == 'InternalServiceErrorException':
                logger.error(f"Internal service error for secret {full_secret_name}: {e}")
            else:
                logger.error(f"Unexpected error retrieving secret {full_secret_name}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error retrieving secret {full_secret_name}: {e}")
            return None
    
    def get_database_config(self) -> Optional[Dict[str, str]]:
        """
        Get database configuration from secrets manager
        
        Returns:
            Dictionary with database configuration or None
        """
        return self.get_secret('database')
    
    def get_django_secret_key(self) -> Optional[str]:
        """
        Get Django secret key from secrets manager
        
        Returns:
            Django secret key or None
        """
        secret_data = self.get_secret('django')
        if secret_data:
            return secret_data.get('secret_key')
        return None
    
    def get_email_config(self) -> Optional[Dict[str, str]]:
        """
        Get email/SES configuration from secrets manager
        
        Returns:
            Dictionary with email configuration or None
        """
        return self.get_secret('email')
    
    def get_s3_config(self) -> Optional[Dict[str, str]]:
        """
        Get S3 configuration from secrets manager
        
        Returns:
            Dictionary with S3 configuration or None
        """
        return self.get_secret('s3')
    
    def create_secret(self, secret_name: str, secret_data: Dict[str, Any], 
                     description: str = None) -> bool:
        """
        Create a new secret in AWS Secrets Manager
        
        Args:
            secret_name: Name of the secret (will be prefixed)
            secret_data: Dictionary containing the secret data
            description: Optional description for the secret
        
        Returns:
            True if successful, False otherwise
        """
        if not self.client:
            logger.error("Secrets Manager client not initialized")
            return False
        
        full_secret_name = f"{self.secrets_prefix}/{secret_name}"
        
        try:
            self.client.create_secret(
                Name=full_secret_name,
                Description=description or f"Secret for {secret_name}",
                SecretString=json.dumps(secret_data),
                Tags=[
                    {'Key': 'Application', 'Value': 'practika'},
                    {'Key': 'Environment', 'Value': settings.DJANGO_ENVIRONMENT or 'production'},
                    {'Key': 'ManagedBy', 'Value': 'django-application'}
                ]
            )
            logger.info(f"Successfully created secret: {full_secret_name}")
            return True
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == 'ResourceExistsException':
                logger.warning(f"Secret {full_secret_name} already exists")
            else:
                logger.error(f"Failed to create secret {full_secret_name}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error creating secret {full_secret_name}: {e}")
            return False
    
    def update_secret(self, secret_name: str, secret_data: Dict[str, Any]) -> bool:
        """
        Update an existing secret in AWS Secrets Manager
        
        Args:
            secret_name: Name of the secret (will be prefixed)
            secret_data: Dictionary containing the updated secret data
        
        Returns:
            True if successful, False otherwise
        """
        if not self.client:
            logger.error("Secrets Manager client not initialized")
            return False
        
        full_secret_name = f"{self.secrets_prefix}/{secret_name}"
        
        try:
            self.client.update_secret(
                SecretId=full_secret_name,
                SecretString=json.dumps(secret_data)
            )
            logger.info(f"Successfully updated secret: {full_secret_name}")
            return True
            
        except ClientError as e:
            logger.error(f"Failed to update secret {full_secret_name}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error updating secret {full_secret_name}: {e}")
            return False


# Singleton instance
secrets_service = AWSSecretsService()


def get_secret_or_env(secret_key: str, env_var: str, default: str = None) -> Optional[str]:
    """
    Helper function to get a value from secrets manager or fall back to environment variable
    
    Args:
        secret_key: Key within the secret
        env_var: Environment variable name
        default: Default value if neither is found
    
    Returns:
        The secret value, environment value, or default
    """
    import os
    
    # Try to get from secrets manager first
    try:
        secret_data = secrets_service.get_secret('application')
        if secret_data and secret_key in secret_data:
            return secret_data[secret_key]
    except Exception as e:
        logger.warning(f"Failed to get secret {secret_key}: {e}")
    
    # Fall back to environment variable
    return os.getenv(env_var, default)
