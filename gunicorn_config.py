import multiprocessing
import os

bind = f"0.0.0.0:{os.getenv('PORT', '5000')}"
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = 'eventlet' 
worker_connections = 1000
timeout = 120
keepalive = 5

accesslog = 'logs/access.log'
errorlog = 'logs/error.log'
loglevel = 'info'
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

preload_app = True
max_requests = 1000
max_requests_jitter = 50

daemon = False
pidfile = 'gunicorn.pid'
