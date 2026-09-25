import mimetypes

from django.db import IntegrityError, transaction
from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from videos.models import JournalAttachment, JournalEntry, Routine, RoutineItem
from videos.serializers import (
    JournalAttachmentSerializer,
    JournalEntrySerializer,
    RoutineItemSerializer,
    RoutineSerializer,
)
from videos.telemetry import record_product_event


DEFAULT_ROUTINES = [
    {
        'name': 'Dental',
        'category': 'Dental',
        'purpose': 'Protect future health with simple daily proof that brushing and flossing happened.',
        'items': [
            {'name': 'Brush teeth', 'default_unit': 'times', 'default_target_quantity': 1},
            {'name': 'Floss', 'default_unit': 'times', 'default_target_quantity': 1},
        ],
    },
    {
        'name': 'Fitness Basics',
        'category': 'Fitness',
        'purpose': 'Make strength and mobility visible so small sets become undeniable progress.',
        'items': [
            {'name': 'Pushups', 'default_unit': 'reps'},
            {'name': 'Flagpole stretch', 'default_unit': 'minutes'},
            {'name': 'Front stretch', 'default_unit': 'minutes'},
        ],
    },
    {
        'name': 'Dragon and Tiger Qigong',
        'category': 'Qigong',
        'learned_from': 'Dorothy',
        'purpose': 'Capture lessons and proof from each form, class, and practice session.',
        'items': [
            {'name': 'Position 1', 'default_unit': 'reps'},
            {'name': 'Position 2', 'default_unit': 'reps'},
            {'name': 'Position 3', 'default_unit': 'reps'},
            {'name': 'Position 4', 'default_unit': 'reps'},
            {'name': 'Position 5', 'default_unit': 'reps'},
            {'name': 'Friday qigong lesson notes', 'default_unit': ''},
        ],
    },
    {
        'name': 'Drum Rudiments',
        'category': 'Drums',
        'learned_from': 'Jimmy',
        'purpose': 'Turn practice reps into a private proof archive that shows real musicianship work.',
        'items': [
            {'name': 'Singles', 'default_unit': 'minutes'},
            {'name': 'Singles and triples', 'default_unit': 'minutes'},
            {'name': 'Flams', 'default_unit': 'minutes'},
            {'name': 'Flam taps', 'default_unit': 'minutes'},
        ],
    },
    {
        'name': 'Food Journal',
        'category': 'Food',
        'purpose': 'Keep meal photos, recipes, and notes in one private health archive.',
        'items': [
            {'name': 'Meal photo', 'default_unit': ''},
            {'name': 'Recipe', 'default_unit': ''},
        ],
    },
    {
        'name': 'Therapy and Lessons',
        'category': 'Learning',
        'purpose': 'Capture what was learned while the memory is fresh and useful.',
        'items': [
            {'name': 'Therapy with Dorothy', 'default_unit': ''},
            {'name': 'Class notes', 'default_unit': ''},
            {'name': 'Lesson takeaways', 'default_unit': ''},
        ],
    },
]


def ensure_default_routines(user):
    created_any = False
    for routine_index, routine_data in enumerate(DEFAULT_ROUTINES):
        routine, created = Routine.objects.get_or_create(
            user=user,
            name=routine_data['name'],
            defaults={
                'category': routine_data['category'],
                'purpose': routine_data['purpose'],
                'learned_from': routine_data.get('learned_from', ''),
                'is_default': True,
                'is_active': True,
            },
        )
        created_any = created_any or created
        updates = {}
        if routine.is_default is False:
            updates['is_default'] = True
        if not routine.category:
            updates['category'] = routine_data['category']
        if not routine.purpose:
            updates['purpose'] = routine_data['purpose']
        if not routine.learned_from and routine_data.get('learned_from'):
            updates['learned_from'] = routine_data['learned_from']
        if updates:
            for field, value in updates.items():
                setattr(routine, field, value)
            routine.save(update_fields=[*updates.keys(), 'updated_at'])

        for item_index, item_data in enumerate(routine_data['items']):
            defaults = {
                'default_unit': item_data.get('default_unit', ''),
                'default_target_quantity': item_data.get('default_target_quantity'),
                'sort_order': routine_index * 100 + item_index,
            }
            RoutineItem.objects.get_or_create(
                routine=routine,
                name=item_data['name'],
                defaults=defaults,
            )
    if not Routine.objects.filter(user=user, is_today=True).exists():
        Routine.objects.filter(user=user, name='Dragon and Tiger Qigong').update(is_today=True)
    return created_any


def _media_type_for_upload(upload):
    content_type = str(getattr(upload, 'content_type', '') or '').lower()
    guessed_type, _ = mimetypes.guess_type(getattr(upload, 'name', '') or '')
    candidate = content_type or str(guessed_type or '').lower()
    if candidate.startswith('image/'):
        return JournalAttachment.TYPE_IMAGE
    if candidate.startswith('video/'):
        return JournalAttachment.TYPE_VIDEO
    if candidate in {'application/pdf', 'text/plain'}:
        return JournalAttachment.TYPE_DOCUMENT
    raise ValidationError({'file': 'Attach an image, video, PDF, or text note.'})


class RoutineViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = RoutineSerializer

    def get_queryset(self):
        ensure_default_routines(self.request.user)
        queryset = (
            Routine.objects
            .filter(user=self.request.user)
            .annotate(entry_count=Count('journal_entries'))
            .prefetch_related('items')
            .order_by('category', 'name')
        )
        if self.request.query_params.get('today') in {'1', 'true', 'yes'}:
            queryset = queryset.filter(is_today=True, is_active=True)
        if self.request.query_params.get('active') in {'1', 'true', 'yes'}:
            queryset = queryset.filter(is_active=True)
        return queryset

    def perform_create(self, serializer):
        try:
            routine = serializer.save(user=self.request.user, is_default=False)
        except IntegrityError as exc:
            raise ValidationError({'name': 'You already have a routine with this name.'}) from exc
        record_product_event(
            event_name='routine_created',
            path='/api/routines/',
            user=self.request.user,
            is_authenticated=True,
            extra={'routine_id': routine.id, 'category': routine.category},
        )

    @action(detail=True, methods=['post'], url_path='items')
    def create_item(self, request, pk=None):
        routine = self.get_object()
        serializer = RoutineItemSerializer(data={**request.data, 'routine': routine.id}, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        item = serializer.save()
        return Response(RoutineItemSerializer(item, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='select-today')
    def select_today(self, request, pk=None):
        routine = self.get_object()
        if not routine.is_active:
            raise ValidationError({'is_active': 'Activate this routine before using it on Today.'})
        with transaction.atomic():
            Routine.objects.filter(user=request.user, is_today=True).exclude(pk=routine.pk).update(is_today=False)
            if not routine.is_today:
                routine.is_today = True
                routine.save(update_fields=['is_today', 'updated_at'])
        record_product_event(
            event_name='today_routine_selected',
            path=f'/api/routines/{routine.id}/select-today/',
            user=request.user,
            is_authenticated=True,
            extra={'routine_id': routine.id, 'category': routine.category},
        )
        refreshed = self.get_queryset().get(pk=routine.pk)
        return Response(self.get_serializer(refreshed).data)


class RoutineItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = RoutineItemSerializer

    def get_queryset(self):
        ensure_default_routines(self.request.user)
        return RoutineItem.objects.filter(routine__user=self.request.user).select_related('routine')

    def perform_create(self, serializer):
        routine = serializer.validated_data.get('routine')
        if not routine or routine.user_id != self.request.user.id:
            raise PermissionDenied('You can only add items to your own routines.')
        serializer.save()

    def perform_update(self, serializer):
        routine = serializer.validated_data.get('routine') or serializer.instance.routine
        if routine.user_id != self.request.user.id:
            raise PermissionDenied('You can only edit your own routine items.')
        serializer.save()


class JournalEntryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = JournalEntrySerializer

    def get_queryset(self):
        qs = (
            JournalEntry.objects
            .filter(user=self.request.user)
            .select_related('routine', 'routine_item')
            .prefetch_related('attachments', 'tags')
        )
        entry_type = self.request.query_params.get('entry_type')
        category = self.request.query_params.get('category')
        routine_id = self.request.query_params.get('routine')
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if entry_type:
            qs = qs.filter(entry_type=entry_type)
        if category:
            qs = qs.filter(category__iexact=category)
        if routine_id:
            qs = qs.filter(routine_id=routine_id)
        if start_date:
            qs = qs.filter(occurred_at__date__gte=start_date)
        if end_date:
            qs = qs.filter(occurred_at__date__lte=end_date)
        return qs

    def perform_create(self, serializer):
        entry = serializer.save(user=self.request.user)
        record_product_event(
            event_name='journal_entry_created',
            path='/api/journal-entries/',
            user=self.request.user,
            is_authenticated=True,
            extra={
                'journal_entry_id': entry.id,
                'entry_type': entry.entry_type,
                'category': entry.category,
                'routine_id': entry.routine_id,
            },
        )

    @action(detail=True, methods=['post'], url_path='attachments')
    def attachments(self, request, pk=None):
        entry = self.get_object()
        upload = request.FILES.get('file')
        if not upload:
            raise ValidationError({'file': 'Choose a file to attach.'})
        media_type = _media_type_for_upload(upload)
        attachment = JournalAttachment.objects.create(
            entry=entry,
            file=upload,
            media_type=media_type,
            caption=str(request.data.get('caption', '') or '').strip(),
        )
        return Response(
            JournalAttachmentSerializer(attachment, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )
