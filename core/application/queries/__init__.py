"""
Application queries
"""

from .get_exercise_query import GetExerciseQuery
from .list_exercises_query import ListExercisesQuery
from .get_comments_query import GetCommentsQuery

__all__ = [
    'GetExerciseQuery',
    'ListExercisesQuery',
    'GetCommentsQuery'
]
