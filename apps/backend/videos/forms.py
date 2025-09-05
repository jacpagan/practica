"""
Forms for your personal practice tracking system.
"""

from django import forms
from .models import ExerciseVideo, PracticeThread

class ExerciseVideoForm(forms.ModelForm):
    """Form for uploading exercise videos"""
    
    class Meta:
        model = ExerciseVideo
        fields = ['title', 'description', 'video_file', 'tags']
        widgets = {
            'title': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'e.g., Friday Drum Lesson - Basic Beats'
            }),
            'description': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 3,
                'placeholder': 'Describe what you learned in this lesson...'
            }),
            'tags': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'e.g., drums, basic-beats, rhythm'
            }),
            'video_file': forms.FileInput(attrs={
                'class': 'form-control',
                'accept': 'video/*'
            })
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['title'].required = True
        self.fields['video_file'].required = True
        self.fields['description'].required = False
        self.fields['tags'].required = False

class PracticeThreadForm(forms.ModelForm):
    """Form for uploading practice thread videos"""
    
    class Meta:
        model = PracticeThread
        fields = ['title', 'description', 'video_file']
        widgets = {
            'title': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'e.g., Friday 4PM Practice - Basic Beats'
            }),
            'description': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 2,
                'placeholder': 'How did the practice go? What did you work on?'
            }),
            'video_file': forms.FileInput(attrs={
                'class': 'form-control',
                'accept': 'video/*'
            })
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['title'].required = True
        self.fields['video_file'].required = True
        self.fields['description'].required = False