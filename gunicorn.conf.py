"""
Gunicorn configuration for Practika production deployment
Simplified configuration for AWS ECS stability
"""

import os


# Server socket
bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"
backlog = 2048

# Worker processes - keep it simple for ECS
workers = int(os.environ.get('GUNICORN_WORKERS', 1))
worker_class = 'sync'
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 100

# Timeout settings
timeout = 30
keepalive = 2
graceful_timeout = 30

# Logging - ensure all logs go to stdout/stderr for ECS
accesslog = '-'
errorlog = '-'
loglevel = 'info'
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = 'practika'

# Server mechanics
daemon = False
pidfile = None
user = None
group = None
tmp_upload_dir = None

# SSL (handled by ALB)
keyfile = None
certfile = None

# Preload app for better performance
preload_app = True

# Worker timeout for startup
worker_tmp_dir = '/dev/shm'

# Disable worker restart on file changes
reload = False

# Enable worker restart on memory threshold
max_requests_jitter = 50

# Worker lifecycle
worker_abort_on_error = True

# Security
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190

# Environment variables
raw_env = [
    'DJANGO_SETTINGS_MODULE=practika_project.settings',
    'PYTHONPATH=/app',
]

# Hook functions
def on_starting(server):
    """Called just after the server is started."""
    server.log.info("Starting Practika server...")

def when_ready(server):
    """Called just after the server is started and workers are spawned."""
    server.log.info("Practika server is ready to accept connections")

def worker_int(worker):
    """Called when a worker receives SIGINT or SIGQUIT."""
    worker.log.info("Worker received SIGINT or SIGQUIT")

def post_fork(server, worker):
    """Called just after a worker has been forked."""
    server.log.info("Worker spawned (pid: %s)", worker.pid)

def post_worker_init(worker):
    """Called just after a worker has initialized the application."""
    worker.log.info("Worker initialized")

def worker_abort(worker):
    """Called when a worker is being aborted."""
    worker.log.info("Worker aborted")

def child_exit(server, worker):
    """Called when a worker has been exited."""
    server.log.info("Worker exited (pid: %s)", worker.pid)

def on_exit(server):
    """Called just before exiting the master process."""
    server.log.info("Server exiting")
