"""
SendGrid email backend for Django
"""
import logging
from django.core.mail.backends.base import BaseEmailBackend
from django.conf import settings
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content, HtmlContent, TextContent

logger = logging.getLogger(__name__)


class SendGridEmailBackend(BaseEmailBackend):
    """
    SendGrid email backend for Django
    """
    
    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.api_key = getattr(settings, 'SENDGRID_API_KEY', '')
        self.from_email = getattr(settings, 'SENDGRID_FROM_EMAIL', 'noreply@practika.com')
        self.from_name = getattr(settings, 'SENDGRID_FROM_NAME', 'Practika')
        
        if not self.api_key:
            logger.warning("SendGrid API key not configured. Emails will not be sent.")
            return
            
        try:
            self.sg = SendGridAPIClient(api_key=self.api_key)
        except Exception as e:
            logger.error(f"Failed to initialize SendGrid client: {e}")
            if not fail_silently:
                raise
    
    def send_messages(self, email_messages):
        """
        Send one or more EmailMessage objects and return the number of email messages sent.
        """
        if not self.api_key:
            logger.warning("SendGrid API key not configured. Skipping email send.")
            return 0
            
        num_sent = 0
        
        for message in email_messages:
            try:
                # Create SendGrid Mail object
                mail = Mail(
                    from_email=Email(self.from_email, self.from_name),
                    to_emails=[To(email) for email in message.to],
                    subject=message.subject,
                    html_content=HtmlContent(message.body) if message.content_subtype == 'html' else None,
                    plain_text_content=TextContent(message.body) if message.content_subtype == 'plain' else None
                )
                
                # Add CC recipients if any
                if message.cc:
                    for cc_email in message.cc:
                        mail.add_cc(Email(cc_email))
                
                # Add BCC recipients if any
                if message.bcc:
                    for bcc_email in message.bcc:
                        mail.add_bcc(Email(bcc_email))
                
                # Send the email
                response = self.sg.send(mail)
                
                if response.status_code in [200, 201, 202]:
                    logger.info(f"Email sent successfully to {message.to}. Status: {response.status_code}")
                    num_sent += 1
                else:
                    logger.error(f"Failed to send email. Status: {response.status_code}, Body: {response.body}")
                    if not self.fail_silently:
                        raise Exception(f"SendGrid API error: {response.status_code}")
                        
            except Exception as e:
                logger.error(f"Error sending email to {message.to}: {e}")
                if not self.fail_silently:
                    raise
                    
        return num_sent
