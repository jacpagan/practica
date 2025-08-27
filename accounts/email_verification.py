"""
Email verification utilities using HMAC-signed tokens.
"""
import base64
import time
from django.conf import settings
from django.core.signing import TimestampSigner, BadSignature, SignatureExpired
from django.utils import timezone
from django.contrib.auth.models import User


class EmailVerificationTokenGenerator:
    """Generate and verify email verification tokens."""
    
    def __init__(self):
        self.signer = TimestampSigner()
        self.max_age = 24 * 60 * 60  # 24 hours in seconds
    
    def generate_token(self, user):
        """Generate a verification token for a user."""
        # Create payload: user_id:email:timestamp
        payload = f"{user.pk}:{user.email}:{int(time.time())}"
        
        # Sign the payload
        token = self.signer.sign(payload)
        
        # Encode for URL safety
        return base64.urlsafe_b64encode(token.encode()).decode()
    
    def verify_token(self, token, user):
        """Verify a token for a user."""
        try:
            # Decode the token
            decoded_token = base64.urlsafe_b64decode(token.encode()).decode()
            
            # Verify signature and timestamp
            payload = self.signer.unsign(decoded_token, max_age=self.max_age)
            
            # Parse payload
            user_id, email, timestamp = payload.split(':')
            
            # Verify user matches
            if int(user_id) != user.pk or email != user.email:
                return False
            
            # Check if email is already verified
            if user.profile.is_email_verified():
                return False
            
            return True
            
        except (BadSignature, SignatureExpired, ValueError, TypeError):
            return False
    
    def is_token_expired(self, token):
        """Check if a token is expired without verifying user."""
        try:
            decoded_token = base64.urlsafe_b64decode(token.encode()).decode()
            self.signer.unsign(decoded_token, max_age=self.max_age)
            return False
        except (BadSignature, SignatureExpired):
            return True


# Global instance
email_verification_token = EmailVerificationTokenGenerator()
