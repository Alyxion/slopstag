"""Test fixtures for Slopstag."""

import asyncio
import multiprocessing
import time
from typing import Generator

import httpx
import pytest


def run_server():
    """Run the NiceGUI server in a subprocess."""
    import uvicorn
    from slopstag.app import create_app

    app = create_app()
    uvicorn.run(app, host="127.0.0.1", port=8081, log_level="warning")


@pytest.fixture(scope="session")
def server_process() -> Generator[multiprocessing.Process, None, None]:
    """Start the server in a subprocess for integration tests.

    NOTE: This fixture starts a real server. Tests using this fixture
    require the server to be accessible and a browser session to be active.
    For unit tests of the Python backend, use mock fixtures instead.
    """
    proc = multiprocessing.Process(target=run_server, daemon=True)
    proc.start()

    # Wait for server to be ready
    base_url = "http://127.0.0.1:8081"
    max_wait = 10
    start = time.time()
    while time.time() - start < max_wait:
        try:
            response = httpx.get(f"{base_url}/api/health", timeout=1)
            if response.status_code == 200:
                break
        except httpx.RequestError:
            pass
        time.sleep(0.1)

    yield proc

    proc.terminate()
    proc.join(timeout=5)


@pytest.fixture(scope="session")
def api_client(server_process) -> Generator[httpx.Client, None, None]:
    """HTTP client for API requests."""
    with httpx.Client(base_url="http://127.0.0.1:8081/api") as client:
        yield client


@pytest.fixture
def async_client() -> Generator[httpx.AsyncClient, None, None]:
    """Async HTTP client for API requests (no server dependency)."""
    with httpx.AsyncClient(base_url="http://127.0.0.1:8081/api") as client:
        yield client


# Mock fixtures for unit testing without browser session
@pytest.fixture
def mock_session_state():
    """Create a mock session state for unit testing."""
    from slopstag.sessions.models import SessionState, LayerInfo

    return SessionState(
        document_width=800,
        document_height=600,
        active_tool="brush",
        foreground_color="#000000",
        background_color="#FFFFFF",
        zoom=1.0,
        layers=[
            LayerInfo(
                id="layer-1",
                name="Background",
                visible=True,
                locked=False,
                opacity=1.0,
                blend_mode="normal",
            )
        ],
        active_layer_id="layer-1",
    )
