"""Serve the browser suite's API: runserver's threaded WSGI server with a deep listen queue.

Parallel browser workers open far more simultaneous connections than runserver's backlog
of ten accepts, and Windows refuses the overflow instead of queueing it.
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from django.core.servers.basehttp import (  # noqa: E402
    WSGIServer,
    get_internal_wsgi_application,
    run,
)


class BrowserSuiteServer(WSGIServer):
    request_queue_size = 512


def main():
    host, port = sys.argv[1].rsplit(":", 1)
    run(
        host,
        int(port),
        get_internal_wsgi_application(),
        threading=True,
        server_cls=BrowserSuiteServer,
    )


if __name__ == "__main__":
    main()
