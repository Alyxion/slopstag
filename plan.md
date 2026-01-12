# Slopstag Image Editor - Implementation Plan

## Overview
Build a JavaScript-based image editor (like GIMP/Photoshop) with NiceGUI + FastAPI as the Python envelope. The JS app works completely standalone; Python backend provides optional filters via plugins.

## Architecture Principles
1. **JS as Primary Logic Holder** - All canvas ops, layer management, UI in vanilla JavaScript
2. **No Local File Access** - Images loaded from backend (skimage samples, plugin sources)
3. **Plugin Architecture** - Python filters attached optionally, JS discovers available filters at startup
4. **Raw Image Transfer** - Uncompressed RGBA bytes (no Base64) for filter processing
5. **Hot Reload** - NiceGUI on port 8080 with `reload=True`
6. **Modular Tool System** - One file per tool, registry-based auto-discovery, easily extensible
7. **Session Management** - Backend can inspect and control all active editor sessions

## Project Structure

```
slopstag/
├── pyproject.toml              # Poetry, Python 3.12+
├── CLAUDE.md                   # Project conventions
├── plan.md                     # This implementation plan
├── main.py                     # NiceGUI entry point
│
├── slopstag/                   # Python package
│   ├── __init__.py
│   ├── app.py                  # FastAPI app factory
│   ├── config.py               # Settings
│   ├── canvas_editor.py        # NiceGUI custom component (Element subclass)
│   ├── canvas_editor.js        # Vue component for editor UI
│   │
│   ├── api/                    # FastAPI endpoints
│   │   ├── __init__.py
│   │   ├── router.py           # Main router
│   │   ├── filters.py          # Filter endpoints (raw RGBA in/out)
│   │   ├── images.py           # Sample image endpoints
│   │   └── sessions.py         # Session management endpoints (NEW)
│   │
│   ├── filters/                # Built-in Python filters
│   │   ├── __init__.py
│   │   ├── base.py             # BaseFilter ABC
│   │   ├── registry.py         # Filter registration
│   │   ├── blur.py             # Gaussian, box blur
│   │   ├── sharpen.py          # Unsharp mask
│   │   ├── edge.py             # Sobel, Canny
│   │   └── color.py            # Grayscale, invert, HSV
│   │
│   ├── images/                 # Image sources
│   │   ├── __init__.py
│   │   ├── providers.py        # Base provider
│   │   └── skimage_samples.py  # All skimage sample images
│   │
│   ├── sessions/               # Session management (NEW)
│   │   ├── __init__.py
│   │   ├── manager.py          # Session registry and tracking
│   │   └── models.py           # Session data models
│   │
│   └── plugins/                # Plugin loader
│       ├── __init__.py
│       └── manager.py
│
├── frontend/                   # Static JS/CSS served by NiceGUI
│   ├── css/
│   │   └── main.css
│   │
│   └── js/
│       ├── app.js              # Entry point (legacy, now in canvas_editor.js)
│       │
│       ├── core/
│       │   ├── Layer.js        # Single layer (offscreen canvas)
│       │   ├── LayerStack.js   # Layer management
│       │   ├── Renderer.js     # Composite to display canvas
│       │   ├── BlendModes.js   # Blend mode mappings
│       │   └── History.js      # Undo/redo
│       │
│       ├── tools/
│       │   ├── Tool.js         # Base tool class (abstract)
│       │   ├── ToolManager.js  # Registry + tool switching
│       │   ├── BrushTool.js    # Freehand painting
│       │   ├── EraserTool.js   # Eraser
│       │   ├── ShapeTool.js    # Rectangle, ellipse, line
│       │   ├── FillTool.js     # Paint bucket
│       │   ├── EyedropperTool.js  # Color picker
│       │   ├── SelectionTool.js   # Rectangular selection
│       │   └── MoveTool.js        # Move layers/selections
│       │
│       ├── ui/
│       │   ├── Toolbar.js      # Top toolbar
│       │   ├── LayerPanel.js   # Layer list + controls
│       │   ├── ColorPicker.js  # Color selection with palette
│       │   ├── PropertyPanel.js # Tool properties
│       │   ├── ToolPanel.js    # Tool buttons
│       │   └── StatusBar.js    # Coordinates, zoom
│       │
│       ├── plugins/
│       │   ├── PluginManager.js    # Discovers backend filters
│       │   ├── BackendConnector.js # HTTP calls to FastAPI
│       │   └── FilterPlugin.js     # Filter interface
│       │
│       └── utils/
│           ├── EventBus.js     # Pub/sub events
│           └── ImageData.js    # RGBA utilities
│
└── plugins/                    # User plugin directory
    └── example_filter/
        ├── manifest.json
        └── filters.py
```

## Session Management API (NEW)

The session API allows Python/backend code to inspect and control all active editor sessions. Each browser tab/window creates a session.

### Session Data Model
```python
@dataclass
class EditorSession:
    id: str                     # Unique session ID (NiceGUI client ID)
    created_at: datetime
    last_activity: datetime
    document_width: int
    document_height: int
    layer_count: int
    active_tool: str
    foreground_color: str
    background_color: str
```

### API Endpoints

#### `GET /api/sessions`
List all active editor sessions.
```json
{
  "sessions": [
    {
      "id": "abc123",
      "created_at": "2024-01-15T10:30:00Z",
      "last_activity": "2024-01-15T10:35:00Z",
      "document_width": 800,
      "document_height": 600,
      "layer_count": 3,
      "active_tool": "brush",
      "foreground_color": "#FF0000",
      "background_color": "#FFFFFF"
    }
  ]
}
```

#### `GET /api/sessions/{session_id}`
Get detailed information about a specific session.
```json
{
  "id": "abc123",
  "document": {
    "width": 800,
    "height": 600
  },
  "layers": [
    {"id": "layer1", "name": "Background", "visible": true, "opacity": 1.0, "blend_mode": "normal"},
    {"id": "layer2", "name": "Layer 1", "visible": true, "opacity": 0.8, "blend_mode": "multiply"}
  ],
  "active_layer_id": "layer2",
  "active_tool": "brush",
  "tool_properties": {"size": 10, "hardness": 100, "opacity": 100},
  "colors": {"foreground": "#FF0000", "background": "#FFFFFF"},
  "zoom": 1.0,
  "recent_colors": ["#FF0000", "#00FF00", "#0000FF"]
}
```

#### `GET /api/sessions/{session_id}/image`
Get the flattened composite image as raw RGBA bytes.
- Response: Binary RGBA data
- Headers: `X-Image-Width`, `X-Image-Height`

#### `GET /api/sessions/{session_id}/layers/{layer_id}`
Get a specific layer's image data as raw RGBA bytes.
- Response: Binary RGBA data
- Headers: `X-Image-Width`, `X-Image-Height`, `X-Layer-Name`, `X-Layer-Opacity`, `X-Layer-Blend-Mode`

#### `POST /api/sessions/{session_id}/tools/{tool_id}/execute`
Execute a tool action on a session (forwarded to JavaScript via NiceGUI events).
```json
{
  "action": "stroke",
  "params": {
    "points": [[100, 100], [150, 120], [200, 110]],
    "size": 10,
    "color": "#FF0000"
  }
}
```

Supported actions per tool:
- **brush**: `stroke` (draw along points)
- **eraser**: `stroke` (erase along points)
- **shape**: `draw` (rectangle, ellipse, line with start/end points)
- **fill**: `fill` (flood fill at point)
- **move**: `translate` (move layer by dx, dy)

#### `POST /api/sessions/{session_id}/command`
Execute arbitrary editor commands.
```json
{
  "command": "undo"
}
```

Supported commands:
- `undo`, `redo`
- `new_layer`, `delete_layer`, `duplicate_layer`, `merge_down`, `flatten`
- `set_foreground_color`, `set_background_color`
- `select_tool`
- `apply_filter`

### Implementation Architecture

```
[Python API Request]
       │
       ▼
[FastAPI /api/sessions/{id}/...]
       │
       ▼
[SessionManager.get_session(id)]
       │
       ▼
[NiceGUI Client Connection]
       │
       ▼
[CanvasEditor.run_method('executeCommand', ...)]
       │
       ▼
[Vue Component methods]
       │
       ▼
[JavaScript Editor Logic]
       │
       ▼
[Response via WebSocket / HTTP]
```

### Session Registration Flow

1. When `CanvasEditor` component mounts, it registers with `SessionManager`
2. Session ID = NiceGUI client ID (unique per browser tab)
3. Editor state updates are pushed to backend via events
4. On disconnect, session is marked inactive (kept for 5 minutes, then removed)

## Enhanced Color Picker (NEW)

The color picker provides multiple ways to select colors:

### Features
1. **Current Colors** - Foreground/background with swap and reset buttons
2. **Common Colors Palette** - 16 basic colors (black, white, grays, primary, secondary colors)
3. **Recent Colors** - Last 12 used colors (persisted per session)
4. **Full HSV Picker** - Hue slider + saturation/value square (expandable panel)
5. **Hex Input** - Direct hex color entry

### UI Layout
```
┌─────────────────────┐
│ [FG] [BG]  ↔  ⟳    │  Current colors + swap/reset
├─────────────────────┤
│ Common Colors       │
│ ■■■■■■■■            │  8x2 grid of basic colors
│ ■■■■■■■■            │
├─────────────────────┤
│ Recent              │
│ ■■■■■■■■■■■■        │  Up to 12 recent colors
├─────────────────────┤
│ [▼ Full Picker]     │  Expandable
│ ┌─────────┐ ┌──┐    │
│ │         │ │▓▓│    │  SV square + H slider
│ │   S/V   │ │▓▓│    │
│ │         │ │▓▓│    │
│ └─────────┘ └──┘    │
│ #______ [Apply]     │  Hex input
└─────────────────────┘
```

### Common Colors Palette
```javascript
const COMMON_COLORS = [
  '#000000', '#FFFFFF', '#808080', '#C0C0C0',  // Black, White, Grays
  '#FF0000', '#00FF00', '#0000FF', '#FFFF00',  // Red, Green, Blue, Yellow
  '#FF00FF', '#00FFFF', '#800000', '#008000',  // Magenta, Cyan, Maroon, Dark Green
  '#000080', '#808000', '#800080', '#008080',  // Navy, Olive, Purple, Teal
];
```

### Recent Colors
- Stored in Vue component data as array
- Updated when user picks a color from palette or full picker
- Maximum 12 colors, FIFO when full
- Persisted to localStorage per session

## Tool System Architecture

The tool system uses a **registry pattern** for maximum extensibility. Each tool is a separate file that self-registers.

### Tool Base Class (`tools/Tool.js`)
```javascript
export class Tool {
    static id = 'tool';           // Unique identifier
    static name = 'Tool';         // Display name
    static icon = 'cursor';       // Icon name
    static shortcut = null;       // Keyboard shortcut (e.g., 'b' for brush)
    static cursor = 'default';    // CSS cursor

    constructor(app) { this.app = app; }

    // Lifecycle
    activate() {}
    deactivate() {}

    // Input handlers (override as needed)
    onMouseDown(e, x, y) {}
    onMouseMove(e, x, y) {}
    onMouseUp(e, x, y) {}
    onMouseLeave(e) {}
    onKeyDown(e) {}
    onKeyUp(e) {}

    // Properties panel definition
    getProperties() { return []; }

    // Remote execution (NEW - for session API)
    executeAction(action, params) {}
}
```

### Tool Manager (`tools/ToolManager.js`)
```javascript
export class ToolManager {
    constructor(app) {
        this.app = app;
        this.tools = new Map();      // id -> Tool instance
        this.currentTool = null;
    }

    // Register a tool class
    register(ToolClass) {
        const tool = new ToolClass(this.app);
        this.tools.set(ToolClass.id, tool);
    }

    // Switch to a tool by id
    select(toolId) {
        this.currentTool?.deactivate();
        this.currentTool = this.tools.get(toolId);
        this.currentTool?.activate();
        this.app.eventBus.emit('tool:changed', { tool: this.currentTool });
    }

    // Get all tools for UI
    getAll() { return Array.from(this.tools.values()); }

    // Execute tool action remotely (NEW)
    executeToolAction(toolId, action, params) {
        const tool = this.tools.get(toolId);
        if (tool?.executeAction) {
            return tool.executeAction(action, params);
        }
    }
}
```

### Adding a New Tool
1. Create `frontend/js/tools/MyTool.js`:
```javascript
import { Tool } from './Tool.js';

export class MyTool extends Tool {
    static id = 'mytool';
    static name = 'My Tool';
    static icon = 'star';
    static shortcut = 'm';
    static cursor = 'crosshair';

    onMouseDown(e, x, y) {
        // Tool logic here
    }

    getProperties() {
        return [
            { id: 'size', name: 'Size', type: 'range', min: 1, max: 100, value: 10 }
        ];
    }

    executeAction(action, params) {
        if (action === 'draw') {
            // Remote execution logic
        }
    }
}
```

2. Import and register in `canvas_editor.js`:
```javascript
import { MyTool } from '/static/js/tools/MyTool.js';
app.toolManager.register(MyTool);
```

### Tool Property Types
- `range`: Slider with min/max/step
- `select`: Dropdown with options array
- `checkbox`: Boolean toggle
- `color`: Color picker
- `number`: Numeric input

## Implementation Steps

### Phase 1: Project Setup ✅
1. Create `pyproject.toml` with Poetry (Python 3.12+)
2. Create `CLAUDE.md` with project conventions
3. Create basic directory structure
4. Create `main.py` with minimal NiceGUI app on port 8080

### Phase 2: Python Backend Core ✅
1. **slopstag/config.py** - Settings class
2. **slopstag/app.py** - FastAPI app factory
3. **slopstag/api/router.py** - Main API router with health endpoint
4. **slopstag/filters/base.py** - BaseFilter ABC with params schema
5. **slopstag/filters/registry.py** - Filter registration decorator
6. **slopstag/images/providers.py** - Base image provider
7. **slopstag/images/skimage_samples.py** - All skimage sample images

### Phase 3: Filter Endpoints ✅
1. **slopstag/api/filters.py** - Filter list and apply endpoints
2. **slopstag/api/images.py** - Image sources and retrieval

### Phase 4: Built-in Filters ✅
1. **blur.py** - Gaussian blur, box blur
2. **sharpen.py** - Unsharp mask
3. **edge.py** - Sobel, Canny edge detection
4. **color.py** - Grayscale, invert, brightness/contrast, sepia

### Phase 5: JavaScript Core ✅
1. **utils/EventBus.js** - Pub/sub event system
2. **core/Layer.js** - Offscreen canvas per layer
3. **core/LayerStack.js** - Layer CRUD, merge, flatten
4. **core/BlendModes.js** - Map to Canvas2D globalCompositeOperation
5. **core/Renderer.js** - Composite layers to display canvas with zoom/pan
6. **core/History.js** - Undo/redo with serialization

### Phase 6: Tool System ✅
1. **tools/Tool.js** - Abstract base class
2. **tools/ToolManager.js** - Registry pattern
3. **tools/BrushTool.js** - Freehand painting
4. **tools/EraserTool.js** - Eraser
5. **tools/ShapeTool.js** - Rectangle, ellipse, line
6. **tools/FillTool.js** - Flood fill
7. **tools/EyedropperTool.js** - Sample color from canvas
8. **tools/MoveTool.js** - Move layer contents

### Phase 7: NiceGUI Custom Component ✅
1. **slopstag/canvas_editor.py** - Python Element subclass
2. **slopstag/canvas_editor.js** - Vue component with full editor UI

### Phase 8: Session Management API (NEW)
1. **slopstag/sessions/models.py** - Session data models
2. **slopstag/sessions/manager.py** - Session registry with NiceGUI integration
3. **slopstag/api/sessions.py** - REST endpoints for sessions
4. **canvas_editor.js** - Add session registration and command execution

### Phase 9: Enhanced Color Picker (NEW)
1. Update **canvas_editor.js** - Add color picker panel with:
   - Common colors palette
   - Recent colors tracking
   - Full HSV picker (expandable)
   - Hex input field

### Phase 10: Tool Remote Execution (NEW)
1. Add `executeAction()` to each tool class
2. Add `executeToolAction()` to ToolManager
3. Add `executeCommand()` method to Vue component
4. Wire up session API to Vue component via NiceGUI events

### Phase 11: Polish & Testing
1. Test all tools on canvas
2. Test layer operations
3. Test filter application
4. Test undo/redo
5. Test session API endpoints
6. Test remote tool execution
7. Verify hot reload works

## Key Files to Modify/Create

| File | Purpose |
|------|---------|
| `pyproject.toml` | Poetry config with all deps |
| `CLAUDE.md` | Project conventions |
| `plan.md` | This implementation plan |
| `main.py` | NiceGUI entry, mounts FastAPI |
| `slopstag/canvas_editor.py` | NiceGUI custom component |
| `slopstag/canvas_editor.js` | Vue component with editor UI |
| `slopstag/api/sessions.py` | Session management endpoints |
| `slopstag/sessions/manager.py` | Session registry |
| `frontend/js/tools/Tool.js` | Add executeAction method |

## Data Flow

```
[User draws on canvas]
       │
       ▼
[BrushTool.onMouseMove]
       │
       ▼
[Layer.ctx.drawImage(brushStamp)]
       │
       ▼
[Renderer.requestRender()]
       │
       ▼
[Composite all layers → display canvas]
```

```
[User applies backend filter]
       │
       ▼
[PluginManager.applyFilter(filterId)]
       │
       ▼
[BackendConnector.applyFilter]
       │
       ▼
[POST /api/filters/{id}]  ← raw RGBA bytes
       │
       ▼
[Python filter.apply(numpy_array)]
       │
       ▼
[Response: raw RGBA bytes]
       │
       ▼
[Layer.setImageData(result)]
       │
       ▼
[Renderer.requestRender()]
```

```
[Backend executes tool via API]  (NEW)
       │
       ▼
[POST /api/sessions/{id}/tools/{tool}/execute]
       │
       ▼
[SessionManager.execute_tool()]
       │
       ▼
[NiceGUI run_method('executeToolAction', ...)]
       │
       ▼
[Vue component → ToolManager.executeToolAction()]
       │
       ▼
[Tool.executeAction(action, params)]
       │
       ▼
[Canvas updated]
       │
       ▼
[Response with result]
```

## Verification Plan
1. Run `pip install -e .` - should succeed
2. Run `python main.py` - should start on http://localhost:8080
3. Open browser - should see canvas with white background
4. Draw with brush - strokes should appear
5. Test color picker - common colors, recent colors, full picker
6. Add layer - layer panel should update
7. Apply filter from menu - image should change
8. Ctrl+Z - should undo
9. Test session API:
   - `GET /api/sessions` - should list active sessions
   - `GET /api/sessions/{id}/image` - should return composite image
   - `POST /api/sessions/{id}/tools/brush/execute` - should draw stroke
10. Load skimage sample - image should appear on new layer

## CLAUDE.md Contents
```markdown
# Slopstag Image Editor

## Quick Start
pip install -e .
python main.py
# Opens http://localhost:8080 with hot reload

## Architecture
- JS-first: Canvas/layer logic runs entirely in browser
- Python backend: Optional filters via FastAPI
- No local file access: Images from backend sources only
- Modular tools: One file per tool, registry-based
- Session API: Backend can inspect and control all sessions

## Development
- NiceGUI hot-reloads on code changes (JS, CSS, Python)
- Port 8080, never needs restart (except adding packages)
- Use chrome-mcp for debugging

## Adding Tools (JS)
1. Create `frontend/js/tools/MyTool.js` extending Tool base class
2. Define static properties: id, name, icon, shortcut, cursor
3. Override mouse/keyboard handlers as needed
4. Add executeAction() for remote execution support
5. Import and register in canvas_editor.js

## Adding Filters (Python)
1. Create class extending BaseFilter in slopstag/filters/
2. Use @register_filter("filter_id") decorator
3. Implement apply(image: np.ndarray, **params) -> np.ndarray

## Adding Image Sources
1. Create provider class in slopstag/images/
2. Use @register_provider("source_id") decorator
3. Implement list_images() and get_image(id)

## Session API
- GET /api/sessions - List all sessions
- GET /api/sessions/{id} - Get session details
- GET /api/sessions/{id}/image - Get composite image
- GET /api/sessions/{id}/layers/{layer_id} - Get layer image
- POST /api/sessions/{id}/tools/{tool}/execute - Execute tool action
- POST /api/sessions/{id}/command - Execute editor command

## File Structure Convention
- One class per file
- Tools in frontend/js/tools/
- Filters in slopstag/filters/
- UI components in frontend/js/ui/
- API endpoints in slopstag/api/
```
