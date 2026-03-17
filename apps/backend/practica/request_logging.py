import json
import os
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
        trace_id = request.META.get("HTTP_X_TRACE_ID")
        if not trace_id:
            trace_id = req_id
        request._trace_id = trace_id
        return None

    def process_response(self, request, response):
        try:
            start = getattr(request, "_start_time", None)
            elapsed_ms = None
            if start is not None:
                elapsed_ms = int((time.perf_counter() - start) * 1000)
            request_id = getattr(request, "_request_id", "")
            trace_id = getattr(request, "_trace_id", request_id)
            # Attach header for clients and proxies
            if request_id:
                response["X-Request-ID"] = request_id
            if trace_id:
                response["X-Trace-ID"] = trace_id

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
                "timestamp": timezone.now().isoformat(),
                "level": "INFO",
                "service": os.getenv("SERVICE_NAME", "practica-api"),
                "environment": os.getenv("ENVIRONMENT", "development"),
                "method": request.method,
                "path": request.get_full_path(),
                "status_code": getattr(response, "status_code", None),
                "latency_ms": elapsed_ms,
                "user_id": getattr(getattr(request, "user", None), "id", None),
                "bytes_out": bytes_out,
                "bytes_in": bytes_in,
                "request_id": request_id,
                "trace_id": trace_id,
                "deployed_sha": os.getenv("DEPLOYED_GIT_SHA", ""),
            }
            # Log to stdout in JSON for aggregation
            print(json.dumps({"type": "access", **payload}), flush=True)
        except Exception:
            # Never break responses due to logging
            pass
        return response

