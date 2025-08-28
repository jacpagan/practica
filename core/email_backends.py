"""
Amazon SES email backend for Django
"""
import logging
import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from django.core.mail.backends.base import BaseEmailBackend
from django.conf import settings
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

logger = logging.getLogger(__name__)


class AmazonSESEmailBackend(BaseEmailBackend):
    """
    Amazon SES email backend for Django
    """
    
    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        
        # Get AWS credentials from settings
        self.aws_access_key_id = getattr(settings, 'AWS_ACCESS_KEY_ID', '')
        self.aws_secret_access_key = getattr(settings, 'AWS_SECRET_ACCESS_KEY', '')
        self.aws_region = getattr(settings, 'AWS_S3_REGION_NAME', 'us-east-1')
        self.from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@practika.com')
        self.from_name = getattr(settings, 'SES_FROM_NAME', 'Practika')
        
        if not self.aws_access_key_id or not self.aws_secret_access_key:
            logger.warning("AWS credentials not configured. Emails will not be sent.")
            return
            
        try:
            # Initialize SES client
            self.ses_client = boto3.client(
                'ses',
                aws_access_key_id=self.aws_access_key_id,
                aws_secret_access_key=self.aws_secret_access_key,
                region_name=self.aws_region
            )
            logger.info("Amazon SES client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Amazon SES client: {e}")
            if not fail_silently:
                raise
    
    def send_messages(self, email_messages):
        """
        Send one or more EmailMessage objects and return the number of email messages sent.
        """
        if not hasattr(self, 'ses_client'):
            logger.warning("Amazon SES client not initialized. Skipping email send.")
            return 0
            
        num_sent = 0
        
        for message in email_messages:
            try:
                # Create MIME message
                msg = MIMEMultipart('alternative')
                msg['Subject'] = message.subject
                msg['From'] = f"{self.from_name} <{self.from_email}>"
                msg['To'] = ', '.join(message.to)
                
                # Add CC recipients if any
                if message.cc:
                    msg['Cc'] = ', '.join(message.cc)
                
                # Add BCC recipients if any
                if message.bcc:
                    msg['Bcc'] = ', '.join(message.bcc)
                
                # Add message body
                if message.content_subtype == 'html':
                    html_part = MIMEText(message.body, 'html')
                    msg.attach(html_part)
                else:
                    text_part = MIMEText(message.body, 'plain')
                    msg.attach(text_part)
                
                # Add attachments if any
                for attachment in message.attachments:
                    if isinstance(attachment, tuple):
                        filename, content, mimetype = attachment
                        part = MIMEBase('application', 'octet-stream')
                        part.set_payload(content)
                        encoders.encode_base64(part)
                        part.add_header('Content-Disposition', f'attachment; filename= {filename}')
                        msg.attach(part)
                
                # Send email via SES
                response = self.ses_client.send_raw_email(
                    Source=self.from_email,
                    Destinations=message.to + (message.cc or []) + (message.bcc or []),
                    RawMessage={'Data': msg.as_string()}
                )
                
                logger.info(f"Email sent successfully to {message.to}. Message ID: {response['MessageId']}")
                num_sent += 1
                
            except ClientError as e:
                error_code = e.response['Error']['Code']
                error_message = e.response['Error']['Message']
                logger.error(f"SES ClientError sending email to {message.to}: {error_code} - {error_message}")
                
                if error_code == 'MessageRejected':
                    logger.error("Email rejected by SES. Check sender verification.")
                elif error_code == 'MailFromDomainNotVerified':
                    logger.error("Sender domain not verified in SES.")
                elif error_code == 'ConfigurationSetDoesNotExist':
                    logger.error("SES configuration set does not exist.")
                    
                if not self.fail_silently:
                    raise
                    
            except Exception as e:
                logger.error(f"Error sending email to {message.to}: {e}")
                if not self.fail_silently:
                    raise
                    
        return num_sent
