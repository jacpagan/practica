KNOWN_VIDEO_EXTENSIONS = (
    'mov',
    'mp4',
    'm4v',
    'webm',
    'avi',
    'mkv',
    'mpeg',
    'mpg',
    'wmv',
    '3gp',
    '3gpp',
    '3g2',
)

GENERIC_VIDEO_CONTENT_TYPES = {
    '',
    'application/octet-stream',
    'binary/octet-stream',
}

VIDEO_CONTENT_TYPE_ALIASES = {
    'application/mp4',
    'application/x-mp4',
    'audio/mp4',
    'application/quicktime',
    'application/3gpp',
    'application/3gpp2',
    'audio/3gpp',
    'audio/3gpp2',
}


def filename_has_video_extension(filename):
    name = str(filename or '').strip().lower()
    return any(name.endswith(f'.{extension}') for extension in KNOWN_VIDEO_EXTENSIONS)


def is_allowed_video_upload(content_type='', filename=''):
    normalized_type = str(content_type or '').strip().lower()
    normalized_name = str(filename or '').strip()

    if normalized_type.startswith('video/'):
        return True
    if normalized_type in VIDEO_CONTENT_TYPE_ALIASES:
        return True
    if normalized_type in GENERIC_VIDEO_CONTENT_TYPES and filename_has_video_extension(normalized_name):
        return True
    if filename_has_video_extension(normalized_name):
        return True
    return False

