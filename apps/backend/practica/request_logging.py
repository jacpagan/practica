import os
import json
import time
import uuid
from django.utils.deprecation import MiddlewareMixin
from django.utils import timezone


class RequestIdLoggingMiddleware(MiddlewareMixin):
    """Attach an X-Request-ID and emit a structured JSON access log.

    Fields: ts, method, path, status, ms, user_id, bytes_out, bytes_in, request_id, deployed_sha.
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
                if hasattr(request, "body") and request.body:
                    bytes_in = len(request.body)
            except Exception:
                bytes_in = None

            payload = {
                "ts": timezone.now().isoformat(),
                "method": request.method,
                "path": request.get_full_path(),
                "status": getattr(response, "status_code", None),
                "ms": elapsed_ms,
                "user_id": getattr(getattr(request, "user", None), "id", None),
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
