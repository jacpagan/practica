from rest_framework import permissions


class IsTeacherOrAdminForExercise(permissions.BasePermission):
    """
    Custom permission to only allow teachers (instructors) or staff users to create/edit/delete exercises.
    All authenticated users can read.
    """
    
    def has_permission(self, request, view):
        # Allow read access to authenticated users
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        
        # Only teachers (instructors) or staff can create/edit/delete
        if not request.user.is_authenticated:
            return False
            
        # Staff users can do everything
        if request.user.is_staff:
            return True
            
        # Check if user is a teacher (instructor)
        if hasattr(request.user, 'profile') and request.user.profile.role:
            return request.user.profile.role.name == 'instructor'
            
        return False

    def has_object_permission(self, request, view, obj):
        # Allow read access to authenticated users
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        
        # Only teachers (instructors) or staff can edit/delete
        if not request.user.is_authenticated:
            return False
            
        # Staff users can do everything
        if request.user.is_staff:
            return True
            
        # Check if user is a teacher (instructor) and owns the exercise
        if hasattr(request.user, 'profile') and request.user.profile.role:
            return (request.user.profile.role.name == 'instructor' and 
                   obj.created_by == request.user)
            
        return False


# Keep the old permission for backward compatibility
class IsAdminForExercise(IsTeacherOrAdminForExercise):
    """
    Legacy permission class - now aliased to the new teacher permission.
    """
    pass
