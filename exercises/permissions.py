from rest_framework import permissions


class IsAdminForExercise(permissions.BasePermission):
    """
    Custom permission to only allow staff users to create/edit/delete exercises.
    All authenticated users can read.
    """
    
    def has_permission(self, request, view):
        # Allow read access to authenticated users
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        
        # Only staff can create/edit/delete
        return request.user.is_authenticated and request.user.is_staff

    def has_object_permission(self, request, view, obj):
        # Allow read access to authenticated users
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        
        # Only staff can edit/delete
        return request.user.is_authenticated and request.user.is_staff
