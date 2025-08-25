"""
Gunicorn configuration for Practika production deployment
Optimized for mobile workloads and video processing
"""

import os
import multiprocessing

# Server socket
bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"
backlog = 2048

# Worker processes
workers = int(os.environ.get('GUNICORN_WORKERS', 1))  # Reduced to 1 worker for stability
worker_class = os.environ.get('GUNICORN_WORKER_CLASS', 'sync')
worker_connections = int(os.environ.get('GUNICORN_WORKER_CONNECTIONS', 1000))
max_requests = int(os.environ.get('GUNICORN_MAX_REQUESTS', 1000))
max_requests_jitter = int(os.environ.get('GUNICORN_MAX_REQUESTS_JITTER', 100))

# Timeout settings
timeout = int(os.environ.get('GUNICORN_TIMEOUT', 30))
keepalive = int(os.environ.get('GUNICORN_KEEPALIVE', 2))
graceful_timeout = int(os.environ.get('GUNICORN_GRACEFUL_TIMEOUT', 30))

# Logging
accesslog = '-'
errorlog = '-'
loglevel = os.environ.get('GUNICORN_LOG_LEVEL', 'info')
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = 'practika'

# Server mechanics
daemon = False
pidfile = None
user = None
group = None
tmp_upload_dir = None

# SSL (not needed for Heroku)
keyfile = None
certfile = None

# Preload app for better performance
preload_app = False

# Worker timeout for startup
worker_tmp_dir = '/dev/shm'  # Use shared memory for better performance

# Disable worker restart on file changes
reload = False
reload_engine = 'auto'

# Enable worker restart on memory threshold
max_requests_jitter = 50

# Worker lifecycle
worker_abort_on_error = True

# Security
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190

# Performance tuning
worker_tmp_dir = '/dev/shm'  # Use RAM for temporary files
max_requests_jitter = 50
preload_app = True

# Gevent specific settings
if worker_class == 'gevent':
    worker_connections = 1000
    max_requests = 1000
    max_requests_jitter = 100

# Environment variables
raw_env = [
    'DJANGO_SETTINGS_MODULE=practika_project.production',
    'PYTHONPATH=/app',
]

# Hook functions
def on_starting(server):
    """Called just after the server is started."""
    server.log.info("Starting Practika server...")

def on_reload(server):
    """Called to reload the server configuration."""
    server.log.info("Reloading Practika server...")

def when_ready(server):
    """Called just after the server is started and workers are spawned."""
    server.log.info("Practika server is ready to accept connections")

def worker_int(worker):
    """Called when a worker receives SIGINT or SIGQUIT."""
    worker.log.info("Worker received SIGINT or SIGQUIT")

def pre_fork(server, worker):
    """Called just before a worker is forked."""
    server.log.info("Worker will be spawned")

def post_fork(server, worker):
    """Called just after a worker has been forked."""
    server.log.info("Worker spawned (pid: %s)", worker.pid)

def post_worker_init(worker):
    """Called just after a worker has initialized the application."""
    worker.log.info("Worker initialized")

def worker_abort(worker):
    """Called when a worker is being aborted."""
    worker.log.info("Worker aborted")

def pre_exec(server):
    """Called just before a new master process is executed."""
    server.log.info("New master process will be executed")

def child_exit(server, worker):
    """Called when a worker has been exited."""
    server.log.info("Worker exited (pid: %s)", worker.pid)

def worker_exit(server, worker):
    """Called when a worker has been exited, in the worker process."""
    worker.log.info("Worker exiting")

def nworkers_changed(server, new_value, old_value):
    """Called when the number of workers is changed."""
    server.log.info("Number of workers changed from %s to %s", old_value, new_value)

def on_exit(server):
    """Called just before exiting the master process."""
    server.log.info("Server exiting")

# Custom settings for mobile optimization
def post_request(worker, req, environ, resp):
    """Called after a request has been processed."""
    # Log mobile-specific metrics
    user_agent = environ.get('HTTP_USER_AGENT', '')
    if 'Mobile' in user_agent or 'Android' in user_agent or 'iPhone' in user_agent:
        worker.log.info("Mobile request processed: %s %s", req.method, req.path)

# Health check endpoint
def health_check(environ, start_response):
    """Simple health check for load balancers."""
    status = '200 OK'
    response_headers = [('Content-Type', 'text/plain')]
    start_response(status, response_headers)
    return [b'OK']

# Add health check to worker
def worker_ready(worker):
    """Called when a worker is ready to accept requests."""
    worker.log.info("Worker ready to accept requests")
    
    # Register health check endpoint
    if hasattr(worker, 'wsgi'):
        worker.wsgi.health_check = health_check
