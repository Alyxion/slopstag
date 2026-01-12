"""Slopstag Image Editor - NiceGUI entry point."""

from pathlib import Path

from nicegui import app, ui

# Import and mount FastAPI backend
from slopstag.app import create_api_app
from slopstag.canvas_editor import CanvasEditor

# Mount API routes
api_app = create_api_app()
app.mount("/api", api_app)

# Serve frontend static files
FRONTEND_DIR = Path(__file__).parent / "frontend"
app.add_static_files("/static", FRONTEND_DIR)


@ui.page("/")
async def index():
    """Main editor page."""
    # Add stylesheet
    ui.add_head_html('<link rel="stylesheet" href="/static/css/main.css">')

    # Create the canvas editor component - it handles everything
    CanvasEditor(width=800, height=600, api_base="/api").classes("w-full h-full")


def main():
    """Run the application."""
    ui.run(
        host="0.0.0.0",
        port=8080,
        title="Slopstag Image Editor",
        reload=True,
        show=False,
        uvicorn_reload_includes="*.py,*.js,*.css,*.html",
    )


if __name__ in {"__main__", "__mp_main__"}:
    main()
