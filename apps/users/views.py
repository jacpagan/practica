# Views for Practika MVP API
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model
from django.db.models import Q
from .serializers import (
    UserSerializer, UserRegistrationSerializer, VideoSerializer,
    PlaylistSerializer, PlaylistCreateSerializer, PublicPlaylistSerializer
)
from apps.playlists.models import Playlist
from apps.videos.models import Video

User = get_user_model()


class IsOwnerOrReadOnly(permissions.BasePermission):
    """Custom permission to only allow owners of an object to edit it."""
    
    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed for any request
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write permissions are only allowed to the owner
        return obj.user == request.user


class IsOwnerOrAdmin(permissions.BasePermission):
    """Custom permission to only allow owners or admins to edit an object."""
    
    def has_object_permission(self, request, view, obj):
        # Admins can do anything
        if request.user.is_admin:
            return True
        
        # Owners can edit their own objects
        return obj.user == request.user


class AuthViewSet(viewsets.ViewSet):
    """Authentication endpoints"""
    
    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny])
    def register(self, request):
        """User registration endpoint"""
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                'message': 'User registered successfully',
                'user': UserSerializer(user).data
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def profile(self, request):
        """Get current user profile"""
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class PlaylistViewSet(viewsets.ModelViewSet):
    """Playlist management endpoints"""
    serializer_class = PlaylistSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]
    
    def get_queryset(self):
        """Filter playlists based on user and privacy"""
        user = self.request.user
        
        if user.is_admin:
            # Admins can see all playlists
            return Playlist.objects.all()
        
        # Users can see their own playlists and public playlists
        return Playlist.objects.filter(
            Q(user=user) | Q(privacy='public')
        )
    
    def get_serializer_class(self):
        """Use different serializers for different actions"""
        if self.action == 'create':
            return PlaylistCreateSerializer
        elif self.action == 'list' and not self.request.user.is_admin:
            return PublicPlaylistSerializer
        return PlaylistSerializer
    
    def perform_create(self, serializer):
        """Set the user when creating a playlist"""
        serializer.save(user=self.request.user)
    
    @action(detail=True, methods=['post'])
    def upload_video(self, request, pk=None):
        """Upload a video to a playlist"""
        playlist = self.get_object()
        
        # Check if user owns the playlist
        if playlist.user != request.user and not request.user.is_admin:
            return Response(
                {'error': 'You can only upload videos to your own playlists'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = VideoSerializer(data=request.data)
        if serializer.is_valid():
            video = serializer.save(playlist=playlist)
            video.update_trust_score()
            playlist.update_trust_score()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'])
    def videos(self, request, pk=None):
        """Get videos for a specific playlist"""
        playlist = self.get_object()
        
        # Check if user can access this playlist
        if playlist.privacy == 'private' and playlist.user != request.user and not request.user.is_admin:
            return Response(
                {'error': 'You do not have permission to view this playlist'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        videos = Video.objects.filter(playlist=playlist)
        serializer = VideoSerializer(videos, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def public(self, request):
        """List only public playlists"""
        queryset = Playlist.objects.filter(privacy='public')
        
        # Search functionality
        search = request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(description__icontains=search) |
                Q(tags__contains=[search])
            )
        
        serializer = PublicPlaylistSerializer(queryset, many=True)
        return Response(serializer.data)


class VideoViewSet(viewsets.ModelViewSet):
    """Video management endpoints"""
    serializer_class = VideoSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]
    
    def get_queryset(self):
        """Filter videos based on user permissions"""
        user = self.request.user
        
        if user.is_admin:
            # Admins can see all videos
            return Video.objects.all()
        
        # Users can see videos from their playlists and public playlists
        return Video.objects.filter(
            Q(playlist__user=user) | Q(playlist__privacy='public')
        )
    
    def perform_update(self, serializer):
        """Update trust score when video is updated"""
        video = serializer.save()
        video.update_trust_score()
    
    def perform_destroy(self, instance):
        """Update playlist trust score when video is deleted"""
        playlist = instance.playlist
        instance.delete()
        playlist.update_trust_score()


class AdminViewSet(viewsets.ViewSet):
    """Admin-only endpoints"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get_permissions(self):
        """Only allow admins"""
        if not self.request.user.is_admin:
            return [permissions.IsAdminUser()]
        return super().get_permissions()
    
    @action(detail=False, methods=['get'])
    def playlists(self, request):
        """Admin endpoint to list all playlists"""
        playlists = Playlist.objects.all()
        serializer = PlaylistSerializer(playlists, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def videos(self, request):
        """Admin endpoint to list all videos"""
        videos = Video.objects.all()
        serializer = VideoSerializer(videos, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def users(self, request):
        """Admin endpoint to list all users"""
        users = User.objects.all()
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)
