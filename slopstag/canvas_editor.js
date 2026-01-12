/**
 * Slopstag Canvas Editor - NiceGUI Vue Component
 *
 * This Vue component provides the UI shell for the image editor.
 * It imports the core modules and initializes the editor in mounted().
 */

// Store editor state outside Vue's reactivity (like Three.js pattern)
const editorState = new WeakMap();

export default {
    template: `
        <div class="editor-root" ref="root">
            <!-- Top toolbar -->
            <div class="toolbar-container">
                <div class="toolbar" ref="toolbar">
                    <div class="toolbar-left">
                        <div class="toolbar-menu">
                            <button class="toolbar-menu-btn" @click="showFileMenu">File</button>
                            <button class="toolbar-menu-btn" @click="showEditMenu">Edit</button>
                            <button class="toolbar-menu-btn" @click="showFilterMenu">Filter</button>
                            <button class="toolbar-menu-btn" @click="showImageMenu">Image</button>
                        </div>
                    </div>
                    <div class="toolbar-center">
                        <span class="toolbar-title">Slopstag</span>
                    </div>
                    <div class="toolbar-right">
                        <span class="toolbar-zoom">{{ Math.round(zoom * 100) }}%</span>
                        <button class="toolbar-btn" @click="zoomIn">+</button>
                        <button class="toolbar-btn" @click="zoomOut">-</button>
                        <button class="toolbar-btn" @click="fitToView">Fit</button>
                    </div>
                </div>
            </div>

            <!-- Main editor area -->
            <div class="editor-main">
                <!-- Left tool panel -->
                <div class="tool-panel">
                    <div class="tool-buttons-section">
                        <button
                            v-for="tool in tools"
                            :key="tool.id"
                            class="tool-button"
                            :class="{ active: currentToolId === tool.id }"
                            :title="tool.name + (tool.shortcut ? ' (' + tool.shortcut.toUpperCase() + ')' : '')"
                            @click="selectTool(tool.id)"
                            v-html="getToolIcon(tool.icon)">
                        </button>
                    </div>
                    <div class="color-picker-section">
                        <!-- Current FG/BG colors -->
                        <div class="color-swatches">
                            <div class="color-swatch-container">
                                <input type="color" class="color-input" :value="fgColor" @input="setForegroundColor($event.target.value)">
                                <div class="color-swatch foreground" :style="{ backgroundColor: fgColor }"></div>
                            </div>
                            <div class="color-swatch-container">
                                <input type="color" class="color-input" :value="bgColor" @input="setBackgroundColor($event.target.value)">
                                <div class="color-swatch background" :style="{ backgroundColor: bgColor }"></div>
                            </div>
                        </div>
                        <div style="display: flex; gap: 4px; margin-top: 4px;">
                            <button class="color-swap" @click="swapColors" title="Swap colors (X)" v-html="'&#8646;'"></button>
                            <button class="color-reset" @click="resetColors" title="Reset colors (D)" v-html="'&#8634;'"></button>
                        </div>
                    </div>
                </div>

                <!-- Color Palette Panel (below tool panel) -->
                <div class="color-palette-panel">
                    <div class="panel-header">Colors</div>
                    <!-- Quick Colors -->
                    <div class="color-palette-section">
                        <div class="section-label">Quick</div>
                        <div class="color-palette-grid quick-colors">
                            <div
                                v-for="color in commonColors"
                                :key="'quick-'+color"
                                class="palette-color"
                                :style="{ backgroundColor: color }"
                                :title="color"
                                @click="setForegroundColor(color)"
                                @contextmenu.prevent="setBackgroundColor(color)">
                            </div>
                        </div>
                    </div>
                    <!-- Recent Colors -->
                    <div class="color-palette-section" v-if="recentColors.length > 0">
                        <div class="section-label">Recent</div>
                        <div class="color-palette-grid recent-colors">
                            <div
                                v-for="(color, idx) in recentColors"
                                :key="'recent-'+idx"
                                class="palette-color"
                                :style="{ backgroundColor: color }"
                                :title="color"
                                @click="setForegroundColor(color)"
                                @contextmenu.prevent="setBackgroundColor(color)">
                            </div>
                        </div>
                    </div>
                    <!-- Full Palette Toggle -->
                    <div class="color-palette-section">
                        <button class="expand-picker-btn" @click="showFullPicker = !showFullPicker">
                            {{ showFullPicker ? '▲ Hide Palette' : '▼ Full Palette' }}
                        </button>
                        <div v-if="showFullPicker" class="full-color-picker">
                            <div class="color-palette-grid full-palette">
                                <div
                                    v-for="(color, idx) in colorPalette"
                                    :key="'palette-'+idx"
                                    class="palette-color small"
                                    :style="{ backgroundColor: color }"
                                    :title="color"
                                    @click="setForegroundColor(color)"
                                    @contextmenu.prevent="setBackgroundColor(color)">
                                </div>
                            </div>
                            <div class="hex-input-row">
                                <input type="color" class="color-picker-native" :value="fgColor" @input="setForegroundColor($event.target.value)">
                                <input
                                    type="text"
                                    class="hex-input"
                                    v-model="hexInput"
                                    @keyup.enter="applyHexColor"
                                    placeholder="#RRGGBB">
                                <button class="hex-apply-btn" @click="applyHexColor">Set</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Canvas container -->
                <div class="canvas-container" ref="canvasContainer">
                    <canvas
                        ref="mainCanvas"
                        tabindex="0"
                        @mousedown="handleMouseDown"
                        @mousemove="handleMouseMove"
                        @mouseup="handleMouseUp"
                        @mouseleave="handleMouseLeave"
                        @wheel.prevent="handleWheel"
                        @contextmenu.prevent
                    ></canvas>
                </div>

                <!-- Right panel -->
                <div class="right-panel">
                    <!-- Layer panel -->
                    <div class="layer-panel">
                        <div class="panel-header">Layers</div>
                        <div class="layer-controls">
                            <select class="layer-blend-mode" v-model="activeLayerBlendMode" @change="updateLayerBlendMode">
                                <option v-for="mode in blendModes" :key="mode" :value="mode">{{ mode }}</option>
                            </select>
                            <div class="layer-opacity-row">
                                <span>Opacity:</span>
                                <input type="range" min="0" max="100" v-model.number="activeLayerOpacity" @input="updateLayerOpacity">
                                <span class="property-value">{{ activeLayerOpacity }}%</span>
                            </div>
                        </div>
                        <div class="layer-list">
                            <div
                                v-for="layer in layers"
                                :key="layer.id"
                                class="layer-item"
                                :class="{ active: layer.id === activeLayerId }"
                                @click="selectLayer(layer.id)">
                                <button
                                    class="layer-visibility"
                                    :class="{ visible: layer.visible }"
                                    @click.stop="toggleLayerVisibility(layer.id)"
                                    v-html="layer.visible ? '&#128065;' : '&#128064;'">
                                </button>
                                <span class="layer-name">{{ layer.name }}</span>
                                <span v-if="layer.locked" class="layer-locked" v-html="'&#128274;'"></span>
                            </div>
                        </div>
                        <div class="layer-buttons">
                            <button @click="addLayer" title="Add layer">+</button>
                            <button @click="deleteLayer" title="Delete layer">-</button>
                            <button @click="duplicateLayer" title="Duplicate layer" v-html="'&#128464;'"></button>
                            <button @click="mergeDown" title="Merge down" v-html="'&#8595;'"></button>
                        </div>
                    </div>

                    <!-- Property panel -->
                    <div class="property-panel">
                        <div class="panel-header">Properties</div>
                        <div class="property-list" v-if="toolProperties.length > 0">
                            <div class="property-row" v-for="prop in toolProperties" :key="prop.id">
                                <label>{{ prop.name }}</label>
                                <template v-if="prop.type === 'range'">
                                    <input
                                        type="range"
                                        :min="prop.min"
                                        :max="prop.max"
                                        :step="prop.step || 1"
                                        :value="prop.value"
                                        @input="updateToolProperty(prop.id, $event.target.value)">
                                    <span class="property-value">{{ prop.value }}</span>
                                </template>
                                <template v-else-if="prop.type === 'select'">
                                    <select :value="prop.value" @change="updateToolProperty(prop.id, $event.target.value)">
                                        <option v-for="opt in prop.options" :key="opt" :value="opt">{{ opt }}</option>
                                    </select>
                                </template>
                            </div>
                        </div>
                        <div class="panel-empty" v-else>No properties</div>
                    </div>
                </div>
            </div>

            <!-- Status bar -->
            <div class="status-bar">
                <span class="status-coords">{{ coordsX }}, {{ coordsY }}</span>
                <span class="status-separator">|</span>
                <span class="status-size">{{ docWidth }} x {{ docHeight }}</span>
                <span class="status-separator">|</span>
                <span class="status-tool">{{ currentToolName }}</span>
                <span class="status-separator">|</span>
                <span class="status-message">{{ statusMessage }}</span>
                <span class="status-right">
                    <span class="status-backend" :class="{ connected: backendConnected, disconnected: !backendConnected }">
                        {{ backendConnected ? 'Backend' : 'Offline' }}
                    </span>
                </span>
            </div>

            <!-- Dropdown menus -->
            <div v-if="activeMenu" class="toolbar-dropdown" :style="menuPosition" @click.stop>
                <template v-if="activeMenu === 'file'">
                    <div class="menu-item" @click="menuAction('new')">New...</div>
                    <div class="menu-separator"></div>
                    <div class="menu-header">Load Sample Image</div>
                    <div class="menu-item" v-for="img in sampleImages" :key="img.id" @click="menuAction('load', img)">
                        {{ img.name }}
                    </div>
                    <div class="menu-separator"></div>
                    <div class="menu-item" @click="menuAction('export')">Export PNG</div>
                </template>
                <template v-else-if="activeMenu === 'edit'">
                    <div class="menu-item" @click="menuAction('undo')">Undo (Ctrl+Z)</div>
                    <div class="menu-item" @click="menuAction('redo')">Redo (Ctrl+Y)</div>
                    <div class="menu-separator"></div>
                    <div class="menu-item" @click="menuAction('cut')">Cut (Ctrl+X)</div>
                    <div class="menu-item" @click="menuAction('copy')">Copy (Ctrl+C)</div>
                    <div class="menu-item" @click="menuAction('paste')">Paste (Ctrl+V)</div>
                    <div class="menu-item" @click="menuAction('paste_in_place')">Paste in Place (Ctrl+Shift+V)</div>
                    <div class="menu-separator"></div>
                    <div class="menu-item" @click="menuAction('select_all')">Select All (Ctrl+A)</div>
                    <div class="menu-item" @click="menuAction('deselect')">Deselect (Ctrl+D)</div>
                </template>
                <template v-else-if="activeMenu === 'filter'">
                    <div class="menu-item disabled" v-if="filters.length === 0">No filters available</div>
                    <template v-for="(categoryFilters, category) in filtersByCategory" :key="category">
                        <div class="menu-header">{{ formatCategory(category) }}</div>
                        <div class="menu-item" v-for="f in categoryFilters" :key="f.id" @click="menuAction('filter', f)">
                            {{ f.name }}
                        </div>
                        <div class="menu-separator"></div>
                    </template>
                </template>
                <template v-else-if="activeMenu === 'image'">
                    <div class="menu-item" @click="menuAction('flatten')">Flatten Image</div>
                </template>
            </div>
        </div>
    `,

    props: {
        canvasWidth: { type: Number, default: 800 },
        canvasHeight: { type: Number, default: 600 },
        apiBase: { type: String, default: '/api' },
        sessionId: { type: String, default: '' },
    },

    computed: {
        filtersByCategory() {
            // Group filters by category
            const categories = {};
            const categoryOrder = ['color', 'blur', 'edge', 'threshold', 'morphology', 'artistic', 'noise', 'sharpen', 'uncategorized'];

            for (const filter of this.filters) {
                const cat = filter.category || 'uncategorized';
                if (!categories[cat]) {
                    categories[cat] = [];
                }
                categories[cat].push(filter);
            }

            // Sort by category order
            const sorted = {};
            for (const cat of categoryOrder) {
                if (categories[cat]) {
                    sorted[cat] = categories[cat];
                }
            }
            // Add any remaining categories
            for (const cat in categories) {
                if (!sorted[cat]) {
                    sorted[cat] = categories[cat];
                }
            }
            return sorted;
        },
    },

    data() {
        return {
            // Document state
            docWidth: 800,
            docHeight: 600,
            zoom: 1.0,

            // Colors
            fgColor: '#000000',
            bgColor: '#FFFFFF',
            // Professional color palette (similar to Photoshop/GIMP)
            colorPalette: [
                // Row 1: Grayscale
                '#000000', '#1a1a1a', '#333333', '#4d4d4d', '#666666', '#808080',
                '#999999', '#b3b3b3', '#cccccc', '#e6e6e6', '#f2f2f2', '#ffffff',
                // Row 2: Reds
                '#330000', '#660000', '#990000', '#cc0000', '#ff0000', '#ff3333',
                '#ff6666', '#ff9999', '#ffcccc', '#ff6600', '#ff9933', '#ffcc66',
                // Row 3: Oranges/Yellows
                '#331a00', '#663300', '#994d00', '#cc6600', '#ff8000', '#ffb366',
                '#332600', '#665200', '#997a00', '#cca300', '#ffcc00', '#ffe066',
                // Row 4: Greens
                '#003300', '#006600', '#009900', '#00cc00', '#00ff00', '#33ff33',
                '#66ff66', '#99ff99', '#ccffcc', '#003319', '#006633', '#00994d',
                // Row 5: Cyans
                '#003333', '#006666', '#009999', '#00cccc', '#00ffff', '#33ffff',
                '#66ffff', '#99ffff', '#ccffff', '#001a33', '#003366', '#004d99',
                // Row 6: Blues
                '#000033', '#000066', '#000099', '#0000cc', '#0000ff', '#3333ff',
                '#6666ff', '#9999ff', '#ccccff', '#19004d', '#330099', '#4d00cc',
                // Row 7: Purples/Magentas
                '#330033', '#660066', '#990099', '#cc00cc', '#ff00ff', '#ff33ff',
                '#ff66ff', '#ff99ff', '#ffccff', '#4d0033', '#990066', '#cc0099',
                // Row 8: Skin tones + Browns
                '#ffd5c8', '#f5c4b8', '#e8b298', '#d4a076', '#c68642', '#8d5524',
                '#663d14', '#4a2c0a', '#331f06', '#ffe4c4', '#deb887', '#d2691e',
            ],
            commonColors: [
                '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
                '#FF00FF', '#00FFFF', '#FF8000', '#8000FF', '#00FF80', '#FF0080',
            ],
            recentColors: [],
            showFullPicker: false,
            hexInput: '#000000',

            // Tools
            tools: [],
            currentToolId: 'brush',
            currentToolName: 'Brush',
            toolProperties: [],

            // Layers
            layers: [],
            activeLayerId: null,
            activeLayerOpacity: 100,
            activeLayerBlendMode: 'normal',
            blendModes: ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion'],

            // Status
            coordsX: 0,
            coordsY: 0,
            statusMessage: 'Ready',
            backendConnected: false,

            // Menu
            activeMenu: null,
            menuPosition: { top: '0px', left: '0px' },

            // Backend data
            filters: [],
            sampleImages: [],

            // Internal state
            isPanning: false,
            lastPanX: 0,
            lastPanY: 0,
        };
    },

    mounted() {
        this.docWidth = this.canvasWidth;
        this.docHeight = this.canvasHeight;
        this.initEditor();

        // Close menu on outside click
        document.addEventListener('click', this.closeMenu);
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        window.addEventListener('resize', this.handleResize);
    },

    beforeUnmount() {
        document.removeEventListener('click', this.closeMenu);
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        window.removeEventListener('resize', this.handleResize);

        const state = this.getState();
        if (state?.renderer) {
            state.renderer.stopRenderLoop();
        }
    },

    methods: {
        getState() {
            return editorState.get(this);
        },

        async initEditor() {
            // Import core modules dynamically
            const [
                { EventBus },
                { LayerStack },
                { Renderer },
                { History },
                { Clipboard },
                { ToolManager },
                { BrushTool },
                { EraserTool },
                { ShapeTool },
                { FillTool },
                { EyedropperTool },
                { MoveTool },
                { LineTool },
                { RectTool },
                { CircleTool },
                { SelectionTool },
                { SprayTool },
                { TextTool },
                { GradientTool },
                { PolygonTool },
                { MagicWandTool },
                { LassoTool },
                { CropTool },
                { BackendConnector },
                { PluginManager },
            ] = await Promise.all([
                import('/static/js/utils/EventBus.js'),
                import('/static/js/core/LayerStack.js'),
                import('/static/js/core/Renderer.js'),
                import('/static/js/core/History.js'),
                import('/static/js/core/Clipboard.js'),
                import('/static/js/tools/ToolManager.js'),
                import('/static/js/tools/BrushTool.js'),
                import('/static/js/tools/EraserTool.js'),
                import('/static/js/tools/ShapeTool.js'),
                import('/static/js/tools/FillTool.js'),
                import('/static/js/tools/EyedropperTool.js'),
                import('/static/js/tools/MoveTool.js'),
                import('/static/js/tools/LineTool.js'),
                import('/static/js/tools/RectTool.js'),
                import('/static/js/tools/CircleTool.js'),
                import('/static/js/tools/SelectionTool.js'),
                import('/static/js/tools/SprayTool.js'),
                import('/static/js/tools/TextTool.js'),
                import('/static/js/tools/GradientTool.js'),
                import('/static/js/tools/PolygonTool.js'),
                import('/static/js/tools/MagicWandTool.js'),
                import('/static/js/tools/LassoTool.js'),
                import('/static/js/tools/CropTool.js'),
                import('/static/js/plugins/BackendConnector.js'),
                import('/static/js/plugins/PluginManager.js'),
            ]);

            // Set up canvas
            const canvas = this.$refs.mainCanvas;
            const container = this.$refs.canvasContainer;
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;

            // Create app-like context object
            const eventBus = new EventBus();
            const app = {
                eventBus,
                canvasWidth: this.docWidth,
                canvasHeight: this.docHeight,
                foregroundColor: this.fgColor,
                backgroundColor: this.bgColor,
                displayCanvas: canvas,
                layerStack: null,
                renderer: null,
                history: null,
                clipboard: null,
                toolManager: null,
                pluginManager: null,
            };

            // Initialize systems
            app.layerStack = new LayerStack(this.docWidth, this.docHeight, eventBus);
            app.renderer = new Renderer(canvas, app.layerStack);
            app.history = new History(app);
            app.clipboard = new Clipboard(app);
            app.toolManager = new ToolManager(app);
            app.pluginManager = new PluginManager(app);

            // Register tools
            app.toolManager.register(SelectionTool);
            app.toolManager.register(LassoTool);
            app.toolManager.register(MagicWandTool);
            app.toolManager.register(MoveTool);
            app.toolManager.register(BrushTool);
            app.toolManager.register(SprayTool);
            app.toolManager.register(EraserTool);
            app.toolManager.register(LineTool);
            app.toolManager.register(RectTool);
            app.toolManager.register(CircleTool);
            app.toolManager.register(PolygonTool);
            app.toolManager.register(ShapeTool);
            app.toolManager.register(FillTool);
            app.toolManager.register(GradientTool);
            app.toolManager.register(TextTool);
            app.toolManager.register(EyedropperTool);
            app.toolManager.register(CropTool);

            // Store state
            editorState.set(this, app);

            // Create initial layer
            app.renderer.resize(this.docWidth, this.docHeight);
            const bgLayer = app.layerStack.addLayer({ name: 'Background' });
            bgLayer.fill('#FFFFFF');

            // Connect to backend
            await app.pluginManager.initialize();

            // Update UI from state
            this.updateToolList();
            this.updateLayerList();
            app.toolManager.select('brush');
            this.currentToolId = 'brush';
            this.updateToolProperties();
            app.renderer.fitToViewport();
            this.zoom = app.renderer.zoom;

            // Set up event listeners
            eventBus.on('tool:changed', (data) => {
                this.currentToolId = data.tool?.constructor.id || '';
                this.currentToolName = data.tool?.constructor.name || '';
                this.updateToolProperties();
            });

            eventBus.on('layer:added', () => this.updateLayerList());
            eventBus.on('layer:removed', () => this.updateLayerList());
            eventBus.on('layer:selected', (data) => {
                this.activeLayerId = data.layer?.id;
                this.updateLayerControls();
            });
            eventBus.on('layer:updated', () => this.updateLayerList());

            eventBus.on('color:foreground-changed', (data) => {
                this.fgColor = data.color;
            });
            eventBus.on('color:background-changed', (data) => {
                this.bgColor = data.color;
            });

            eventBus.on('backend:connected', () => {
                this.backendConnected = true;
                this.loadBackendData();
            });
            eventBus.on('backend:disconnected', () => {
                this.backendConnected = false;
            });

            // Also try to load backend data directly after initialization
            // (in case the event was missed)
            setTimeout(() => {
                if (!this.backendConnected) {
                    this.loadBackendData().then(() => {
                        if (this.filters.length > 0) {
                            this.backendConnected = true;
                        }
                    });
                }
            }, 1000);

            this.statusMessage = 'Ready';
            console.log('Slopstag Editor initialized');
        },

        async loadBackendData() {
            const app = this.getState();
            if (!app?.pluginManager) return;

            try {
                const filtersResponse = await fetch(`${this.apiBase}/filters`);
                if (filtersResponse.ok) {
                    const data = await filtersResponse.json();
                    this.filters = data.filters || [];
                }

                const sourcesResponse = await fetch(`${this.apiBase}/images/sources`);
                if (sourcesResponse.ok) {
                    const sources = await sourcesResponse.json();
                    // Load images from first source (skimage)
                    for (const source of sources) {
                        const imagesResponse = await fetch(`${this.apiBase}/images/${source.id}`);
                        if (imagesResponse.ok) {
                            const images = await imagesResponse.json();
                            this.sampleImages = images.map(img => ({
                                id: img.id,
                                name: img.name,
                                source: source.id,
                            }));
                            break;
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to load backend data:', e);
            }
        },

        updateToolList() {
            const app = this.getState();
            if (!app?.toolManager) return;
            this.tools = app.toolManager.getAll().map(t => ({
                id: t.constructor.id,
                name: t.constructor.name,
                icon: t.constructor.icon,
                shortcut: t.constructor.shortcut,
            }));
        },

        updateToolProperties() {
            const app = this.getState();
            const tool = app?.toolManager?.currentTool;
            if (!tool) {
                this.toolProperties = [];
                return;
            }
            this.toolProperties = tool.getProperties ? tool.getProperties() : [];
        },

        updateLayerList() {
            const app = this.getState();
            if (!app?.layerStack) return;
            this.layers = app.layerStack.layers.slice().reverse().map(l => ({
                id: l.id,
                name: l.name,
                visible: l.visible,
                locked: l.locked,
                opacity: l.opacity,
                blendMode: l.blendMode,
            }));
            this.activeLayerId = app.layerStack.getActiveLayer()?.id;
            this.updateLayerControls();
        },

        updateLayerControls() {
            const app = this.getState();
            const layer = app?.layerStack?.getActiveLayer();
            if (layer) {
                this.activeLayerOpacity = Math.round(layer.opacity * 100);
                this.activeLayerBlendMode = layer.blendMode;
            }
        },

        formatCategory(category) {
            // Format category name for display
            const names = {
                'color': 'Color Adjustments',
                'blur': 'Blur & Smooth',
                'edge': 'Edge Detection',
                'threshold': 'Threshold',
                'morphology': 'Morphological',
                'artistic': 'Artistic Effects',
                'noise': 'Noise',
                'sharpen': 'Sharpen',
                'uncategorized': 'Other',
            };
            return names[category] || category.charAt(0).toUpperCase() + category.slice(1);
        },

        getToolIcon(icon) {
            const icons = {
                'selection': '&#9633;',    // White square (selection)
                'lasso': '&#10551;',       // Lasso curve
                'magicwand': '&#10022;',   // Star/wand
                'move': '&#9995;',         // Hand
                'brush': '&#128396;',      // Pencil
                'spray': '&#9729;',        // Cloud (spray)
                'eraser': '&#9986;',       // Scissors
                'line': '&#9585;',         // Diagonal line
                'rect': '&#9634;',         // Square
                'circle': '&#9679;',       // Circle
                'polygon': '&#11039;',     // Pentagon
                'shape': '&#9671;',        // Diamond
                'fill': '&#128276;',       // Bell (bucket)
                'gradient': '&#9698;',     // Gradient triangle
                'text': '&#84;',           // Letter T
                'eyedropper': '&#128083;', // Eyeglasses
                'crop': '&#8862;',         // Crop frame
            };
            return icons[icon] || '&#9679;';
        },

        // Tool selection
        selectTool(toolId) {
            const app = this.getState();
            if (!app?.toolManager) return;
            app.toolManager.select(toolId);
        },

        updateToolProperty(propId, value) {
            const app = this.getState();
            const tool = app?.toolManager?.currentTool;
            if (!tool) return;
            const numValue = parseFloat(value);
            tool[propId] = isNaN(numValue) ? value : numValue;
            if (tool.onPropertyChanged) {
                tool.onPropertyChanged(propId, tool[propId]);
            }
            this.updateToolProperties();
        },

        // Color
        setForegroundColor(color) {
            this.fgColor = color;
            this.hexInput = color;
            this.addRecentColor(color);
            const app = this.getState();
            if (app) {
                app.foregroundColor = color;
                app.eventBus.emit('color:foreground-changed', { color });
            }
            this.emitStateUpdate();
        },

        setBackgroundColor(color) {
            this.bgColor = color;
            this.addRecentColor(color);
            const app = this.getState();
            if (app) {
                app.backgroundColor = color;
                app.eventBus.emit('color:background-changed', { color });
            }
            this.emitStateUpdate();
        },

        addRecentColor(color) {
            // Don't add if it's already the most recent
            if (this.recentColors[0] === color) return;
            // Remove if already in list
            const idx = this.recentColors.indexOf(color);
            if (idx !== -1) {
                this.recentColors.splice(idx, 1);
            }
            // Add to front
            this.recentColors.unshift(color);
            // Keep max 12
            if (this.recentColors.length > 12) {
                this.recentColors.pop();
            }
        },

        applyHexColor() {
            let hex = this.hexInput.trim();
            if (!hex.startsWith('#')) hex = '#' + hex;
            if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                this.setForegroundColor(hex);
            }
        },

        swapColors() {
            const temp = this.fgColor;
            this.setForegroundColor(this.bgColor);
            this.setBackgroundColor(temp);
        },

        resetColors() {
            this.setForegroundColor('#000000');
            this.setBackgroundColor('#FFFFFF');
        },

        // Layer operations
        selectLayer(layerId) {
            const app = this.getState();
            if (!app?.layerStack) return;
            const index = app.layerStack.getLayerIndex(layerId);
            if (index >= 0) {
                app.layerStack.setActiveLayer(index);
                this.activeLayerId = layerId;
                this.updateLayerControls();
            }
        },

        toggleLayerVisibility(layerId) {
            const app = this.getState();
            if (!app?.layerStack) return;
            const layer = app.layerStack.layers.find(l => l.id === layerId);
            if (layer) {
                layer.visible = !layer.visible;
                app.renderer.requestRender();
                this.updateLayerList();
            }
        },

        updateLayerOpacity() {
            const app = this.getState();
            const layer = app?.layerStack?.getActiveLayer();
            if (layer) {
                layer.opacity = this.activeLayerOpacity / 100;
                app.renderer.requestRender();
            }
        },

        updateLayerBlendMode() {
            const app = this.getState();
            const layer = app?.layerStack?.getActiveLayer();
            if (layer) {
                layer.blendMode = this.activeLayerBlendMode;
                app.renderer.requestRender();
            }
        },

        addLayer() {
            const app = this.getState();
            if (!app?.layerStack) return;
            app.layerStack.addLayer({ name: `Layer ${app.layerStack.layers.length + 1}` });
        },

        deleteLayer() {
            const app = this.getState();
            if (!app?.layerStack) return;
            if (app.layerStack.layers.length <= 1) return;
            app.layerStack.removeLayer(app.layerStack.activeLayerIndex);
        },

        duplicateLayer() {
            const app = this.getState();
            if (!app?.layerStack) return;
            app.layerStack.duplicateLayer(app.layerStack.activeLayerIndex);
        },

        mergeDown() {
            const app = this.getState();
            if (!app?.layerStack) return;
            app.layerStack.mergeDown(app.layerStack.activeLayerIndex);
        },

        // Zoom
        zoomIn() {
            const app = this.getState();
            if (!app?.renderer) return;
            const canvas = this.$refs.mainCanvas;
            app.renderer.zoomAt(1.25, canvas.width / 2, canvas.height / 2);
            this.zoom = app.renderer.zoom;
        },

        zoomOut() {
            const app = this.getState();
            if (!app?.renderer) return;
            const canvas = this.$refs.mainCanvas;
            app.renderer.zoomAt(0.8, canvas.width / 2, canvas.height / 2);
            this.zoom = app.renderer.zoom;
        },

        fitToView() {
            const app = this.getState();
            if (!app?.renderer) return;
            app.renderer.fitToViewport();
            this.zoom = app.renderer.zoom;
        },

        // Menus
        showFileMenu(e) {
            this.showMenu('file', e);
        },
        showEditMenu(e) {
            this.showMenu('edit', e);
        },
        showFilterMenu(e) {
            this.showMenu('filter', e);
        },
        showImageMenu(e) {
            this.showMenu('image', e);
        },

        showMenu(menu, e) {
            e.stopPropagation();
            const rect = e.target.getBoundingClientRect();
            this.menuPosition = {
                top: rect.bottom + 'px',
                left: rect.left + 'px',
            };
            this.activeMenu = this.activeMenu === menu ? null : menu;
        },

        closeMenu() {
            this.activeMenu = null;
        },

        async menuAction(action, data) {
            this.closeMenu();
            const app = this.getState();

            switch (action) {
                case 'new':
                    await this.newDocument(800, 600);
                    break;
                case 'load':
                    if (data) await this.loadSampleImage(data);
                    break;
                case 'export':
                    this.exportPNG();
                    break;
                case 'undo':
                    app?.history?.undo();
                    break;
                case 'redo':
                    app?.history?.redo();
                    break;
                case 'cut':
                    this.clipboardCut();
                    break;
                case 'copy':
                    this.clipboardCopy();
                    break;
                case 'paste':
                    this.clipboardPaste();
                    break;
                case 'paste_in_place':
                    this.clipboardPasteInPlace();
                    break;
                case 'select_all':
                    this.selectAll();
                    break;
                case 'deselect':
                    this.deselect();
                    break;
                case 'filter':
                    if (data) await this.applyFilter(data.id, {});
                    break;
                case 'flatten':
                    app?.layerStack?.flattenAll();
                    this.updateLayerList();
                    break;
            }
        },

        // Canvas events
        handleMouseDown(e) {
            const app = this.getState();
            if (!app) return;

            const rect = this.$refs.mainCanvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            const { x, y } = app.renderer.screenToCanvas(screenX, screenY);

            // Middle mouse for panning
            if (e.button === 1) {
                this.isPanning = true;
                this.lastPanX = e.clientX;
                this.lastPanY = e.clientY;
                return;
            }

            app.toolManager.currentTool?.onMouseDown(e, x, y);
        },

        handleMouseMove(e) {
            const app = this.getState();
            if (!app) return;

            const rect = this.$refs.mainCanvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            const { x, y } = app.renderer.screenToCanvas(screenX, screenY);

            // Update status bar coordinates
            this.coordsX = Math.round(x);
            this.coordsY = Math.round(y);

            // Handle panning
            if (this.isPanning) {
                const dx = e.clientX - this.lastPanX;
                const dy = e.clientY - this.lastPanY;
                app.renderer.pan(dx, dy);
                this.lastPanX = e.clientX;
                this.lastPanY = e.clientY;
                return;
            }

            app.toolManager.currentTool?.onMouseMove(e, x, y);
        },

        handleMouseUp(e) {
            const app = this.getState();
            if (!app) return;

            if (this.isPanning) {
                this.isPanning = false;
                return;
            }

            const rect = this.$refs.mainCanvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            const { x, y } = app.renderer.screenToCanvas(screenX, screenY);

            app.toolManager.currentTool?.onMouseUp(e, x, y);
        },

        handleMouseLeave(e) {
            this.isPanning = false;
            const app = this.getState();
            app?.toolManager?.currentTool?.onMouseLeave(e);
        },

        handleWheel(e) {
            const app = this.getState();
            if (!app?.renderer) return;

            const rect = this.$refs.mainCanvas.getBoundingClientRect();
            const centerX = e.clientX - rect.left;
            const centerY = e.clientY - rect.top;

            const factor = e.deltaY > 0 ? 0.9 : 1.1;
            app.renderer.zoomAt(factor, centerX, centerY);
            this.zoom = app.renderer.zoom;
        },

        handleKeyDown(e) {
            const app = this.getState();
            if (!app) return;

            // Ctrl/Cmd shortcuts
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'z':
                        e.preventDefault();
                        if (e.shiftKey) {
                            app.history.redo();
                        } else {
                            app.history.undo();
                        }
                        return;
                    case 'y':
                        e.preventDefault();
                        app.history.redo();
                        return;
                    case 'c':
                        e.preventDefault();
                        this.clipboardCopy();
                        return;
                    case 'x':
                        e.preventDefault();
                        this.clipboardCut();
                        return;
                    case 'v':
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.clipboardPasteInPlace();
                        } else {
                            this.clipboardPaste();
                        }
                        return;
                    case 'a':
                        e.preventDefault();
                        this.selectAll();
                        return;
                    case 'd':
                        e.preventDefault();
                        this.deselect();
                        return;
                }
            }

            // Tool shortcuts (no modifiers)
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                if (e.key === 'x' || e.key === 'X') {
                    this.swapColors();
                    return;
                }
                if (e.key === 'd' || e.key === 'D') {
                    this.resetColors();
                    return;
                }
                // Escape to deselect
                if (e.key === 'Escape') {
                    this.deselect();
                    return;
                }
                // Delete to clear selection
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    this.deleteSelection();
                    return;
                }
                if (app.toolManager.handleShortcut(e.key)) {
                    return;
                }
            }

            app.toolManager.currentTool?.onKeyDown(e);
        },

        handleKeyUp(e) {
            const app = this.getState();
            app?.toolManager?.currentTool?.onKeyUp(e);
        },

        handleResize() {
            const app = this.getState();
            if (!app) return;

            const canvas = this.$refs.mainCanvas;
            const container = this.$refs.canvasContainer;
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
            app.renderer.centerCanvas();
        },

        // Public methods (callable from Python)
        async newDocument(width, height) {
            const app = this.getState();
            if (!app) return;

            this.docWidth = width;
            this.docHeight = height;
            app.canvasWidth = width;
            app.canvasHeight = height;

            // Reset layer stack (need to import dynamically)
            const { LayerStack } = await import('/static/js/core/LayerStack.js');
            app.layerStack = new LayerStack(width, height, app.eventBus);
            app.renderer.layerStack = app.layerStack;
            app.renderer.resize(width, height);

            // Create initial layer
            const bgLayer = app.layerStack.addLayer({ name: 'Background' });
            bgLayer.fill('#FFFFFF');

            app.history.clear();
            this.updateLayerList();
            app.renderer.fitToViewport();
            this.zoom = app.renderer.zoom;
        },

        undo() {
            const app = this.getState();
            app?.history?.undo();
        },

        redo() {
            const app = this.getState();
            app?.history?.redo();
        },

        async loadSampleImage(img) {
            const app = this.getState();
            if (!app) return;

            this.statusMessage = `Loading ${img.name}...`;
            try {
                const response = await fetch(`${this.apiBase}/images/${img.source}/${img.id}`);
                if (!response.ok) throw new Error('Failed to fetch image');

                // Get metadata from header
                const metadata = JSON.parse(response.headers.get('X-Image-Metadata') || '{}');
                const width = metadata.width || 800;
                const height = metadata.height || 600;

                // Get raw RGBA data
                const buffer = await response.arrayBuffer();
                const rgba = new Uint8ClampedArray(buffer);

                // Create new document with image dimensions
                this.docWidth = width;
                this.docHeight = height;
                app.canvasWidth = width;
                app.canvasHeight = height;

                // Recreate layer stack with new dimensions
                const { LayerStack } = await import('/static/js/core/LayerStack.js');
                app.layerStack = new LayerStack(width, height, app.eventBus);
                app.renderer.layerStack = app.layerStack;
                app.renderer.resize(width, height);

                // Create layer and set image data
                const layer = app.layerStack.addLayer({ name: img.name });
                const imageData = new ImageData(rgba, width, height);
                layer.ctx.putImageData(imageData, 0, 0);

                app.history.clear();
                this.updateLayerList();
                app.renderer.fitToViewport();
                this.zoom = app.renderer.zoom;
                this.statusMessage = 'Ready';
            } catch (e) {
                console.error('Failed to load image:', e);
                this.statusMessage = 'Failed to load image';
            }
        },

        async applyFilter(filterId, params) {
            const app = this.getState();
            if (!app?.pluginManager) return;

            this.statusMessage = 'Applying filter...';
            try {
                await app.pluginManager.applyFilter(filterId, app.layerStack.getActiveLayer(), params);
                app.renderer.requestRender();
                this.statusMessage = 'Ready';
            } catch (e) {
                console.error('Failed to apply filter:', e);
                this.statusMessage = 'Filter failed';
            }
        },

        exportPNG() {
            const app = this.getState();
            if (!app?.layerStack) return;

            // Flatten to temp canvas
            const flatCanvas = document.createElement('canvas');
            flatCanvas.width = this.docWidth;
            flatCanvas.height = this.docHeight;
            const ctx = flatCanvas.getContext('2d');

            // White background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, this.docWidth, this.docHeight);

            // Draw all visible layers
            for (const layer of app.layerStack.layers) {
                if (!layer.visible) continue;
                ctx.globalAlpha = layer.opacity;
                ctx.drawImage(layer.canvas, 0, 0);
            }

            // Export
            const link = document.createElement('a');
            link.download = 'slopstag-export.png';
            link.href = flatCanvas.toDataURL('image/png');
            link.click();
        },

        // ===== Selection Methods =====

        getSelection() {
            const app = this.getState();
            const selectionTool = app?.toolManager?.tools.get('selection');
            return selectionTool?.getSelection() || null;
        },

        selectAll() {
            const app = this.getState();
            const selectionTool = app?.toolManager?.tools.get('selection');
            if (selectionTool) {
                selectionTool.selectAll();
                // Switch to selection tool
                app.toolManager.select('selection');
            }
        },

        deselect() {
            const app = this.getState();
            const selectionTool = app?.toolManager?.tools.get('selection');
            selectionTool?.clearSelection();
        },

        deleteSelection() {
            const app = this.getState();
            if (!app) return;

            const selection = this.getSelection();
            const layer = app.layerStack.getActiveLayer();
            if (!layer || layer.locked) return;

            if (selection && selection.width > 0 && selection.height > 0) {
                app.history.saveState('delete_selection');
                layer.ctx.clearRect(
                    Math.floor(selection.x),
                    Math.floor(selection.y),
                    Math.ceil(selection.width),
                    Math.ceil(selection.height)
                );
                app.renderer.requestRender();
            }
        },

        // ===== Clipboard Methods =====

        clipboardCopy() {
            const app = this.getState();
            if (!app?.clipboard) return false;

            const selection = this.getSelection();
            const success = app.clipboard.copy(selection);
            if (success) {
                this.statusMessage = 'Copied to clipboard';
            }
            return success;
        },

        clipboardCut() {
            const app = this.getState();
            if (!app?.clipboard) return false;

            const selection = this.getSelection();
            const success = app.clipboard.cut(selection);
            if (success) {
                this.statusMessage = 'Cut to clipboard';
                app.renderer.requestRender();
            }
            return success;
        },

        clipboardPaste() {
            const app = this.getState();
            if (!app?.clipboard) return false;

            const success = app.clipboard.paste({ asNewLayer: true });
            if (success) {
                this.statusMessage = 'Pasted as new layer';
                this.updateLayerList();
            }
            return success;
        },

        clipboardPasteInPlace() {
            const app = this.getState();
            if (!app?.clipboard) return false;

            const success = app.clipboard.pasteInPlace(true);
            if (success) {
                this.statusMessage = 'Pasted in place';
                this.updateLayerList();
            }
            return success;
        },

        // ===== Session API Methods (called from Python) =====

        emitStateUpdate() {
            // Emit state to Python for session tracking
            const app = this.getState();
            this.$emit('state-update', {
                document_width: this.docWidth,
                document_height: this.docHeight,
                active_tool: this.currentToolId,
                tool_properties: this.toolProperties.reduce((acc, p) => { acc[p.id] = p.value; return acc; }, {}),
                foreground_color: this.fgColor,
                background_color: this.bgColor,
                zoom: this.zoom,
                recent_colors: this.recentColors,
                active_layer_id: this.activeLayerId,
                layers: this.layers,
            });
        },

        executeCommand(command, params = {}) {
            // Execute editor commands from Python
            const app = this.getState();
            if (!app) return { success: false, error: 'Editor not initialized' };

            try {
                switch (command) {
                    case 'undo':
                        app.history.undo();
                        break;
                    case 'redo':
                        app.history.redo();
                        break;
                    case 'new_layer':
                        this.addLayer();
                        break;
                    case 'delete_layer':
                        this.deleteLayer();
                        break;
                    case 'duplicate_layer':
                        this.duplicateLayer();
                        break;
                    case 'merge_down':
                        this.mergeDown();
                        break;
                    case 'flatten':
                        app.layerStack.flattenAll();
                        this.updateLayerList();
                        break;
                    case 'set_foreground_color':
                        if (params.color) this.setForegroundColor(params.color);
                        break;
                    case 'set_background_color':
                        if (params.color) this.setBackgroundColor(params.color);
                        break;
                    case 'select_tool':
                        if (params.tool_id) this.selectTool(params.tool_id);
                        break;
                    case 'apply_filter':
                        if (params.filter_id) this.applyFilter(params.filter_id, params.params || {});
                        break;
                    case 'new_document':
                        if (params.width && params.height) this.newDocument(params.width, params.height);
                        break;
                    // Selection commands
                    case 'select_all':
                        this.selectAll();
                        break;
                    case 'deselect':
                        this.deselect();
                        break;
                    case 'delete_selection':
                        this.deleteSelection();
                        break;
                    // Clipboard commands
                    case 'copy':
                        return { success: this.clipboardCopy() };
                    case 'cut':
                        return { success: this.clipboardCut() };
                    case 'paste':
                        return { success: this.clipboardPaste() };
                    case 'paste_in_place':
                        return { success: this.clipboardPasteInPlace() };
                    default:
                        return { success: false, error: `Unknown command: ${command}` };
                }
                return { success: true };
            } catch (e) {
                return { success: false, error: e.message };
            }
        },

        executeToolAction(toolId, action, params = {}) {
            // Execute tool actions from Python
            const app = this.getState();
            if (!app) return { success: false, error: 'Editor not initialized' };

            const tool = app.toolManager.tools.get(toolId);
            if (!tool) return { success: false, error: `Tool not found: ${toolId}` };

            try {
                // Select the tool first if not already selected
                if (app.toolManager.currentTool !== tool) {
                    app.toolManager.select(toolId);
                }

                // If the tool has its own executeAction, use it
                if (tool.executeAction) {
                    const result = tool.executeAction(action, params);
                    if (result) {
                        this.emitStateUpdate();
                        return result;
                    }
                }

                // Fallback: Execute the action based on generic patterns
                const layer = app.layerStack.getActiveLayer();
                if (!layer) return { success: false, error: 'No active layer' };

                switch (action) {
                    case 'stroke':
                        // Draw a stroke along points
                        if (!params.points || params.points.length < 2) {
                            return { success: false, error: 'Need at least 2 points for stroke' };
                        }
                        app.history.saveState('remote_stroke');
                        const points = params.points;
                        // Simulate mouse events for the tool
                        tool.onMouseDown({ button: 0 }, points[0][0], points[0][1]);
                        for (let i = 1; i < points.length; i++) {
                            tool.onMouseMove({ button: 0 }, points[i][0], points[i][1]);
                        }
                        tool.onMouseUp({ button: 0 }, points[points.length-1][0], points[points.length-1][1]);
                        app.renderer.requestRender();
                        break;

                    case 'fill':
                        // Flood fill at a point
                        if (params.point) {
                            app.history.saveState('remote_fill');
                            tool.onMouseDown({ button: 0 }, params.point[0], params.point[1]);
                            tool.onMouseUp({ button: 0 }, params.point[0], params.point[1]);
                            app.renderer.requestRender();
                        }
                        break;

                    case 'translate':
                        // Move layer
                        if (params.dx !== undefined && params.dy !== undefined) {
                            app.history.saveState('remote_move');
                            const ctx = layer.ctx;
                            const imageData = ctx.getImageData(0, 0, this.docWidth, this.docHeight);
                            ctx.clearRect(0, 0, this.docWidth, this.docHeight);
                            ctx.putImageData(imageData, params.dx, params.dy);
                            app.renderer.requestRender();
                        }
                        break;

                    case 'draw':
                        // Draw shape - fallback for tools without executeAction
                        if (params.start && params.end) {
                            app.history.saveState('remote_shape');
                            tool.onMouseDown({ button: 0 }, params.start[0], params.start[1]);
                            tool.onMouseMove({ button: 0 }, params.end[0], params.end[1]);
                            tool.onMouseUp({ button: 0 }, params.end[0], params.end[1]);
                            app.renderer.requestRender();
                        }
                        break;

                    default:
                        return { success: false, error: `Unknown action: ${action}` };
                }

                this.emitStateUpdate();
                return { success: true };
            } catch (e) {
                return { success: false, error: e.message };
            }
        },

        getImageData(layerId = null) {
            // Get image data as base64 for Python
            const app = this.getState();
            if (!app) return null;

            try {
                let canvas, width, height, layerInfo = {};

                if (layerId) {
                    // Get specific layer
                    const layer = app.layerStack.layers.find(l => l.id === layerId);
                    if (!layer) return { error: 'Layer not found' };
                    canvas = layer.canvas;
                    width = canvas.width;
                    height = canvas.height;
                    layerInfo = {
                        name: layer.name,
                        opacity: layer.opacity,
                        blend_mode: layer.blendMode,
                    };
                } else {
                    // Get flattened composite
                    canvas = document.createElement('canvas');
                    canvas.width = this.docWidth;
                    canvas.height = this.docHeight;
                    const ctx = canvas.getContext('2d');

                    // White background
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, this.docWidth, this.docHeight);

                    // Composite all visible layers
                    for (const layer of app.layerStack.layers) {
                        if (!layer.visible) continue;
                        ctx.globalAlpha = layer.opacity;
                        ctx.drawImage(layer.canvas, 0, 0);
                    }
                    ctx.globalAlpha = 1.0;
                    width = this.docWidth;
                    height = this.docHeight;
                }

                // Get raw pixel data and encode as base64
                const ctx = canvas.getContext('2d');
                const imageData = ctx.getImageData(0, 0, width, height);
                const base64 = this.arrayBufferToBase64(imageData.data.buffer);

                return {
                    data: base64,
                    width: width,
                    height: height,
                    ...layerInfo,
                };
            } catch (e) {
                return { error: e.message };
            }
        },

        arrayBufferToBase64(buffer) {
            let binary = '';
            const bytes = new Uint8Array(buffer);
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary);
        },
    },
};
