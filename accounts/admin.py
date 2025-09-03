from django.contrib import admin
from .models import BetaInvitation


@admin.register(BetaInvitation)
class BetaInvitationAdmin(admin.ModelAdmin):
    list_display = ("email", "token", "accepted_at")
    search_fields = ("email",)
    readonly_fields = ("token", "accepted_at")
