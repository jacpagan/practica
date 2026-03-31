import os
import json
import time
import uuid
import re
from django.utils.deprecation import MiddlewareMixin
from django.utils import timezone


TOKEN_PATH_PATTERNS = [
    (re.compile(r'^/r/[^/]+$'), '/r/:token'),
    (re.compile(r'^/api/review/[^/]+/$'), '/api/review/:token/'),
    (re.compile(r'^/api/review/[^/]+/feedback/$'), '/api/review/:token/feedback/'),
]


def _sanitized_path(request):
    path = str(getattr(request, 'path', '') or '').strip() or '/'
    for pattern, replacement in TOKEN_PATH_PATTERNS:
        if pattern.match(path):
            return replacement
    return path


class RequestIdLoggingMiddleware(MiddlewareMixin):
    """Attach an X-Request-ID and emit a structured JSON access log.

    Fields: ts, method, path, status, ms, is_authenticated, bytes_out, bytes_in, request_id, deployed_sha.
    """

    header_name = "HTTP_X_REQUEST_ID"

    def process_request(self, request):
        request._start_time = time.perf_counter()
        req_id = request.META.get(self.header_name)
        if not req_id:
            req_id = uuid.uuid4().hex
        request._request_id = req_id
        return None

    def process_response(self, request, response):
        try:
            start = getattr(request, "_start_time", None)
            elapsed_ms = None
            if start is not None:
                elapsed_ms = int((time.perf_counter() - start) * 1000)
            request_id = getattr(request, "_request_id", "")
            # Attach header for clients and proxies
            if request_id:
                response["X-Request-ID"] = request_id

            # Best-effort bytes in/out
            bytes_out = None
            try:
                if hasattr(response, "content") and response.content is not None:
                    bytes_out = len(response.content)
            except Exception:
                bytes_out = None
            bytes_in = None
            try:
                raw_length = request.META.get('CONTENT_LENGTH')
                if raw_length:
                    bytes_in = int(raw_length)
            except Exception:
                bytes_in = None

            payload = {
                "ts": timezone.now().isoformat(),
                "method": request.method,
                "path": _sanitized_path(request),
                "status": getattr(response, "status_code", None),
                "ms": elapsed_ms,
                "is_authenticated": bool(getattr(getattr(request, "user", None), "is_authenticated", False)),
                "bytes_out": bytes_out,
                "bytes_in": bytes_in,
                "request_id": request_id,
                "deployed_sha": os.getenv("DEPLOYED_GIT_SHA", ""),
            }
            # Log to stdout in JSON for aggregation
            print(json.dumps({"type": "access", **payload}), flush=True)
        except Exception:
            # Never break responses due to logging
            pass
        return response
