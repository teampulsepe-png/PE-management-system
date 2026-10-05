"""
In-memory SSE connection registry.

Each connected client gets an asyncio.Queue. When a notification is created
in a sync route handler (thread pool), push() uses call_soon_threadsafe to
safely enqueue the event onto the async event loop.
"""

import asyncio
from collections import defaultdict

_loop: asyncio.AbstractEventLoop | None = None
_connections: dict[str, list[asyncio.Queue]] = defaultdict(list)


def set_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


def register(member_id: str, queue: asyncio.Queue) -> None:
    _connections[member_id].append(queue)


def unregister(member_id: str, queue: asyncio.Queue) -> None:
    try:
        _connections[member_id].remove(queue)
    except (ValueError, KeyError):
        pass
    if member_id in _connections and not _connections[member_id]:
        del _connections[member_id]


def push(member_id: str, data: str) -> None:
    """Thread-safe: can be called from sync (thread-pool) route handlers."""
    if _loop is None:
        return
    for queue in list(_connections.get(member_id, [])):
        _loop.call_soon_threadsafe(queue.put_nowait, data)
