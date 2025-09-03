from rest_framework import permissions


class IsAuthorOrAdmin(permissions.BasePermission):
    """
    Custom permission to only allow authors of a comment or staff users to edit/delete.
    All authenticated users can read.
    """
    
    def has_permission(self, request, view):
        # Allow read access to authenticated users
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        
        # Allow create to authenticated users
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        # Allow read access to authenticated users
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        
        # Allow edit/delete to author or staff
        return obj.author == request.user or request.user.is_staff
