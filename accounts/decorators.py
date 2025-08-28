from functools import wraps
from django.http import HttpResponseForbidden
from django.utils import timezone

from .models import BetaInvitation


def beta_invitation_required(view_func):
    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        token = request.GET.get("token") or request.session.get("beta_invite_token")
        if not token:
            return HttpResponseForbidden("Invitation required")
        try:
            invitation = BetaInvitation.objects.get(token=token)
            if invitation.accepted_at is None:
                invitation.accepted_at = timezone.now()
                invitation.save(update_fields=["accepted_at"])
            request.session["beta_invite_token"] = invitation.token
        except BetaInvitation.DoesNotExist:
            return HttpResponseForbidden("Invitation required")
        return view_func(request, *args, **kwargs)
    return _wrapped
