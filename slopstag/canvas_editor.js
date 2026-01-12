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
                            <button class="toolbar-menu-btn" @click="showViewMenu">View</button>
                            <button class="toolbar-menu-btn" @click="showFilterMenu">Filter</button>
                            <button class="toolbar-menu-btn" @click="showImageMenu">Image</button>
                        </div>
                    </div>
                    <div class="toolbar-center">
                        <span class="toolbar-title">Slopstag</span>
                    </div>
                    <div class="toolbar-right">
                        <span class="toolbar-zoom">{{ Math.round(zoom * 100) }}%</span>
                    </div>
                </div>
            </div>

            <!-- Tool Settings Ribbon -->
            <div class="ribbon-bar" v-show="showRibbon">
                <div class="ribbon-tool-name">{{ currentToolName }}</div>

                <!-- Color controls in ribbon -->
                <div class="ribbon-colors">
                    <div class="ribbon-color-swatch" :style="{ backgroundColor: fgColor }" @click="openColorPicker('fg', $event)" title="Foreground color"></div>
                    <div class="ribbon-color-swatch bg" :style="{ backgroundColor: bgColor }" @click="openColorPicker('bg', $event)" title="Background color"></div>
                    <button class="ribbon-color-btn" @click="swapColors" title="Swap (X)">&#8646;</button>
                    <button class="ribbon-color-btn" @click="resetColors" title="Reset (D)">&#8634;</button>
                </div>

                <div class="ribbon-separator"></div>

                <!-- Tool properties -->
                <div class="ribbon-properties" v-if="toolProperties.length > 0">
                    <div class="ribbon-prop" v-for="prop in toolProperties" :key="prop.id">
                        <label>{{ prop.name }}</label>
                        <template v-if="prop.type === 'range'">
                            <input
                                type="range"
                                :min="prop.min"
                                :max="prop.max"
                                :step="prop.step || 1"
                                :value="prop.value"
                                @input="updateToolProperty(prop.id, $event.target.value)">
                            <span class="ribbon-value">{{ prop.value }}</span>
                        </template>
                        <template v-else-if="prop.type === 'select'">
                            <select :value="prop.value" @change="updateToolProperty(prop.id, $event.target.value)">
                                <option v-for="opt in prop.options" :key="opt.value !== undefined ? opt.value : opt" :value="opt.value !== undefined ? opt.value : opt">{{ opt.label || opt }}</option>
                            </select>
                        </template>
                        <template v-else-if="prop.type === 'checkbox'">
                            <input type="checkbox" :checked="prop.value" @change="updateToolProperty(prop.id, $event.target.checked)">
                        </template>
                        <template v-else-if="prop.type === 'color'">
                            <input type="color" :value="prop.value" @input="updateToolProperty(prop.id, $event.target.value)">
                        </template>
                    </div>
                </div>

            </div>

            <!-- Color Picker Popup -->
            <div v-if="colorPickerVisible" class="color-picker-popup" :style="colorPickerPosition" @click.stop>
                <div class="color-picker-header">
                    <span>{{ colorPickerTarget === 'fg' ? 'Foreground' : 'Background' }} Color</span>
                    <button @click="closeColorPicker">&times;</button>
                </div>
                <div class="color-picker-body">
                    <input type="color" class="color-picker-large" :value="colorPickerTarget === 'fg' ? fgColor : bgColor"
                        @input="setPickerColor($event.target.value)">
                    <div class="color-picker-hex">
                        <input type="text" v-model="hexInput" @keyup.enter="applyHexColor" placeholder="#RRGGBB">
                        <button @click="applyHexColor">Set</button>
                    </div>
                    <div class="color-picker-section" v-if="recentColors.length > 0">
                        <div class="section-label">Recent</div>
                        <div class="color-grid">
                            <div v-for="(color, idx) in recentColors" :key="'recent-'+idx"
                                class="color-cell" :style="{ backgroundColor: color }"
                                @click="setPickerColor(color)"></div>
                        </div>
                    </div>
                    <div class="color-picker-section">
                        <div class="section-label">Swatches</div>
                        <div class="color-grid large">
                            <div v-for="(color, idx) in commonColors" :key="'common-'+idx"
                                class="color-cell" :style="{ backgroundColor: color }"
                                @click="setPickerColor(color)"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Main editor area -->
            <div class="editor-main">
                <!-- Left tool panel -->
                <div class="tool-panel" v-show="showToolPanel">
                    <div class="tool-buttons-section">
                        <!-- Tool Groups -->
                        <div class="tool-group" v-for="group in toolGroups" :key="group.id"
                            @mouseenter="showToolFlyout(group)"
                            @mouseleave="scheduleCloseFlyout">
                            <button
                                class="tool-button"
                                :class="{ active: isToolGroupActive(group) }"
                                :title="getActiveToolInGroup(group).name + (group.shortcut ? ' (' + group.shortcut.toUpperCase() + ', Shift+' + group.shortcut.toUpperCase() + ' to cycle)' : '')"
                                @click="selectToolFromGroup(group)">
                                <span class="tool-icon" v-html="getToolIcon(getActiveToolInGroup(group).icon)"></span>
                            </button>
                            <span class="tool-group-indicator" v-if="group.tools.length > 1">&#9662;</span>
                            <!-- Tool group flyout (shown on hover) -->
                            <div class="tool-flyout" v-if="activeToolFlyout === group.id"
                                @mouseenter="cancelCloseFlyout"
                                @mouseleave="scheduleCloseFlyout">
                                <button
                                    v-for="tool in group.tools"
                                    :key="tool.id"
                                    class="flyout-tool-btn"
                                    :class="{ active: currentToolId === tool.id }"
                                    :title="tool.name"
                                    @click="selectToolFromFlyout(group, tool)">
                                    <span class="flyout-icon" v-html="getToolIcon(tool.icon)"></span>
                                    <span class="flyout-name">{{ tool.name }}</span>
                                </button>
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
                <div class="right-panel" v-show="showRightPanel">
                    <!-- Navigator panel -->
                    <div class="navigator-panel" v-show="showNavigator">
                        <div class="panel-header" @mousedown="startPanelDrag('navigator', $event)">
                            Navigator
                            <button class="panel-collapse-btn" @click="toggleNavigator">&#9660;</button>
                        </div>
                        <div class="navigator-content">
                            <canvas ref="navigatorCanvas" class="navigator-canvas"
                                @mousedown="navigatorMouseDown"
                                @mousemove="navigatorMouseMove"
                                @mouseup="navigatorMouseUp"></canvas>
                            <div class="navigator-zoom">
                                <input type="range" min="10" max="800" :value="Math.round(zoom * 100)"
                                    @input="setZoomPercent($event.target.value)">
                                <input type="number" class="zoom-input" :value="Math.round(zoom * 100)"
                                    @change="setZoomPercent($event.target.value)" min="10" max="800">
                                <span>%</span>
                            </div>
                        </div>
                    </div>

                    <!-- Layer panel -->
                    <div class="layer-panel" v-show="showLayers">
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
                                <span class="layer-type-icon" v-if="layer.isVector" title="Vector Layer">&#9674;</span>
                                <span class="layer-type-icon raster" v-else title="Pixel Layer">&#9632;</span>
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

                    <!-- History panel -->
                    <div class="history-panel" v-show="showHistory">
                        <div class="panel-header">History</div>
                        <div class="history-list">
                            <div
                                v-for="(entry, idx) in historyList"
                                :key="idx"
                                class="history-item"
                                :class="{ current: entry.isCurrent, future: entry.isFuture }"
                                @click="jumpToHistory(idx)">
                                <span class="history-icon" v-html="entry.icon || '&#9679;'"></span>
                                <span class="history-name">{{ entry.name }}</span>
                            </div>
                            <div class="panel-empty" v-if="historyList.length <= 1">No history</div>
                        </div>
                        <div class="history-buttons">
                            <button @click="undo" :disabled="!canUndo" :title="lastUndoAction ? 'Undo: ' + lastUndoAction : 'Undo'">
                                &#8630; Undo
                            </button>
                            <button @click="redo" :disabled="!canRedo" :title="lastRedoAction ? 'Redo: ' + lastRedoAction : 'Redo'">
                                Redo &#8631;
                            </button>
                        </div>
                    </div>

                    <!-- Image Sources panel -->
                    <div class="sources-panel" v-show="showSources">
                        <div class="panel-header">Image Sources</div>
                        <div class="sources-list">
                            <div class="source-category" v-for="(images, source) in imageSources" :key="source">
                                <div class="source-header" @click="toggleSourceCategory(source)">
                                    <span>{{ formatSourceName(source) }}</span>
                                    <span class="source-count">({{ images.length }})</span>
                                </div>
                                <div class="source-images" v-if="expandedSources[source]">
                                    <div
                                        v-for="img in images"
                                        :key="img.id"
                                        class="source-image"
                                        @click="loadSourceImage(source, img)"
                                        :title="img.name">
                                        {{ img.name }}
                                    </div>
                                </div>
                            </div>
                        </div>
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
                    <span class="status-memory" :title="'History: ' + memoryUsedMB.toFixed(1) + '/' + memoryMaxMB + ' MB'">
                        <span class="memory-bar">
                            <span class="memory-fill" :style="{ width: memoryPercent + '%' }" :class="{ warning: memoryPercent > 75 }"></span>
                        </span>
                        <span class="memory-text">{{ memoryUsedMB.toFixed(1) }}MB</span>
                    </span>
                    <span class="status-separator">|</span>
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
                    <div class="menu-item" :class="{ disabled: !canUndo }" @click="canUndo && menuAction('undo')">
                        Undo{{ lastUndoAction ? ' ' + lastUndoAction : '' }} (Ctrl+Z)
                    </div>
                    <div class="menu-item" :class="{ disabled: !canRedo }" @click="canRedo && menuAction('redo')">
                        Redo{{ lastRedoAction ? ' ' + lastRedoAction : '' }} (Ctrl+Y)
                    </div>
                    <div class="menu-separator"></div>
                    <div class="menu-item" @click="menuAction('cut')">Cut (Ctrl+X)</div>
                    <div class="menu-item" @click="menuAction('copy')">Copy (Ctrl+C)</div>
                    <div class="menu-item" @click="menuAction('paste')">Paste (Ctrl+V)</div>
                    <div class="menu-item" @click="menuAction('paste_in_place')">Paste in Place (Ctrl+Shift+V)</div>
                    <div class="menu-separator"></div>
                    <div class="menu-item" @click="menuAction('select_all')">Select All (Ctrl+A)</div>
                    <div class="menu-item" @click="menuAction('deselect')">Deselect (Ctrl+D)</div>
                </template>
                <template v-else-if="activeMenu === 'view'">
                    <div class="menu-header">Panels</div>
                    <div class="menu-item menu-checkbox" @click="toggleViewOption('showToolPanel')">
                        <span class="menu-check" v-html="showToolPanel ? '&#10003;' : ''"></span>
                        Tools
                    </div>
                    <div class="menu-item menu-checkbox" @click="toggleViewOption('showRibbon')">
                        <span class="menu-check" v-html="showRibbon ? '&#10003;' : ''"></span>
                        Tool Options (Ribbon)
                    </div>
                    <div class="menu-item menu-checkbox" @click="toggleViewOption('showRightPanel')">
                        <span class="menu-check" v-html="showRightPanel ? '&#10003;' : ''"></span>
                        Right Panel
                    </div>
                    <div class="menu-item menu-checkbox" @click="toggleViewOption('showNavigator')">
                        <span class="menu-check" v-html="showNavigator ? '&#10003;' : ''"></span>
                        Navigator
                    </div>
                    <div class="menu-item menu-checkbox" @click="toggleViewOption('showLayers')">
                        <span class="menu-check" v-html="showLayers ? '&#10003;' : ''"></span>
                        Layers
                    </div>
                    <div class="menu-item menu-checkbox" @click="toggleViewOption('showHistory')">
                        <span class="menu-check" v-html="showHistory ? '&#10003;' : ''"></span>
                        History
                    </div>
                    <div class="menu-item menu-checkbox" @click="toggleViewOption('showSources')">
                        <span class="menu-check" v-html="showSources ? '&#10003;' : ''"></span>
                        Image Sources
                    </div>
                    <div class="menu-separator"></div>
                    <div class="menu-header">Zoom</div>
                    <div class="menu-item" @click="menuAction('zoom_in')">Zoom In (Ctrl++)</div>
                    <div class="menu-item" @click="menuAction('zoom_out')">Zoom Out (Ctrl+-)</div>
                    <div class="menu-item" @click="menuAction('zoom_fit')">Fit to Window</div>
                    <div class="menu-item" @click="menuAction('zoom_100')">Actual Pixels (100%)</div>
                </template>
                <template v-else-if="activeMenu === 'filter'">
                    <div class="menu-item disabled" v-if="filters.length === 0">No filters available</div>
                    <template v-for="(categoryFilters, category) in filtersByCategory" :key="category">
                        <div class="menu-submenu" @mouseenter="openSubmenu(category, $event)" @mouseleave="closeSubmenuDelayed">
                            <span>{{ formatCategory(category) }}</span>
                            <span class="submenu-arrow">▶</span>
                        </div>
                    </template>
                </template>
                <template v-else-if="activeMenu === 'image'">
                    <div class="menu-item" @click="menuAction('flatten')">Flatten Image</div>
                </template>
            </div>

            <!-- Filter submenu -->
            <div v-if="activeSubmenu" class="toolbar-dropdown filter-submenu" :style="submenuPosition"
                 @mouseenter="cancelSubmenuClose" @mouseleave="closeSubmenuDelayed" @click.stop>
                <div class="menu-item" v-for="f in filtersByCategory[activeSubmenu]" :key="f.id"
                     @click="openFilterDialog(f)">
                    {{ f.name }}
                    <span v-if="f.params && f.params.length > 0" class="has-params">...</span>
                </div>
            </div>

            <!-- Filter Dialog -->
            <div v-if="filterDialogVisible" class="filter-dialog-overlay" @click="cancelFilterDialog">
                <div class="filter-dialog" @click.stop>
                    <div class="filter-dialog-header">
                        <span class="filter-dialog-title">{{ currentFilter?.name }}</span>
                        <button class="filter-dialog-close" @click="cancelFilterDialog">&times;</button>
                    </div>
                    <div class="filter-dialog-body">
                        <div class="filter-description" v-if="currentFilter?.description">
                            {{ currentFilter.description }}
                        </div>
                        <div class="filter-params" v-if="currentFilter?.params?.length > 0">
                            <div class="filter-param" v-for="param in currentFilter.params" :key="param.id">
                                <label>{{ param.name }}</label>
                                <template v-if="param.type === 'range'">
                                    <div class="param-range-row">
                                        <input type="range"
                                            :min="param.min"
                                            :max="param.max"
                                            :step="param.step || 1"
                                            v-model.number="filterParams[param.id]"
                                            @input="updateFilterPreview">
                                        <input type="number"
                                            class="param-number-input"
                                            :min="param.min"
                                            :max="param.max"
                                            :step="param.step || 1"
                                            v-model.number="filterParams[param.id]"
                                            @change="updateFilterPreview">
                                    </div>
                                </template>
                                <template v-else-if="param.type === 'select'">
                                    <select v-model="filterParams[param.id]" @change="updateFilterPreview">
                                        <option v-for="opt in param.options" :key="opt" :value="opt">{{ opt }}</option>
                                    </select>
                                </template>
                                <template v-else-if="param.type === 'checkbox'">
                                    <input type="checkbox" v-model="filterParams[param.id]" @change="updateFilterPreview">
                                </template>
                            </div>
                        </div>
                        <div class="filter-no-params" v-else>
                            This filter has no adjustable parameters.
                        </div>
                    </div>
                    <div class="filter-dialog-footer">
                        <label class="preview-checkbox">
                            <input type="checkbox" v-model="filterPreviewEnabled" @change="toggleFilterPreview">
                            Preview
                        </label>
                        <div class="filter-dialog-buttons">
                            <button class="btn-cancel" @click="cancelFilterDialog">Cancel</button>
                            <button class="btn-apply" @click="applyFilterConfirm">Apply</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Rasterize Dialog -->
            <div v-if="showRasterizePrompt" class="filter-dialog-overlay" @click="cancelRasterize">
                <div class="filter-dialog rasterize-dialog" @click.stop>
                    <div class="filter-dialog-header">
                        <span class="filter-dialog-title">Rasterize Layer?</span>
                        <button class="filter-dialog-close" @click="cancelRasterize">&times;</button>
                    </div>
                    <div class="filter-dialog-body">
                        <p class="rasterize-warning">
                            This layer contains vector shapes. To use pixel tools (brush, eraser, fill),
                            the layer must be rasterized first.
                        </p>
                        <p class="rasterize-info">
                            Rasterizing converts vector shapes to pixels. This action cannot be undone
                            (shapes will no longer be individually editable).
                        </p>
                    </div>
                    <div class="filter-dialog-footer">
                        <div class="filter-dialog-buttons">
                            <button class="btn-cancel" @click="cancelRasterize">Cancel</button>
                            <button class="btn-apply" @click="confirmRasterize">Rasterize</button>
                        </div>
                    </div>
                </div>
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

            // View options
            showToolPanel: true,
            showRibbon: true,
            showRightPanel: true,
            showNavigator: true,
            showLayers: true,
            showHistory: true,
            showSources: true,

            // Color picker popup
            colorPickerVisible: false,
            colorPickerTarget: 'fg',  // 'fg' or 'bg'
            colorPickerPosition: { top: '60px', left: '100px' },

            // Tools
            tools: [],
            toolGroups: [],
            activeGroupTools: {},  // groupId -> selected toolId
            currentToolId: 'brush',
            currentToolName: 'Brush',
            toolProperties: [],
            activeToolFlyout: null,
            toolFlyoutTimeout: null,
            flyoutCloseTimeout: null,

            // History
            historyList: [],
            historyIndex: -1,
            canUndo: false,
            canRedo: false,
            lastUndoAction: '',
            lastRedoAction: '',

            // Image sources
            imageSources: {},
            expandedSources: {},

            // Navigator
            navigatorDragging: false,

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
            memoryUsedMB: 0,
            memoryMaxMB: 256,
            memoryPercent: 0,

            // Menu
            activeMenu: null,
            menuPosition: { top: '0px', left: '0px' },
            activeSubmenu: null,
            submenuPosition: { top: '0px', left: '0px' },
            submenuCloseTimeout: null,

            // Filter dialog state
            filterDialogVisible: false,
            currentFilter: null,
            filterParams: {},
            filterPreviewEnabled: true,
            filterPreviewState: null,
            filterPreviewDebounce: null,

            // Rasterize dialog state
            showRasterizePrompt: false,
            rasterizeLayerId: null,
            rasterizeCallback: null,

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
                { HandTool },
                { VectorShapeEditTool },
                { PenTool },
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
                import('/static/js/tools/HandTool.js'),
                import('/static/js/tools/VectorShapeEditTool.js'),
                import('/static/js/tools/PenTool.js'),
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

            // Add utility methods to app
            app.showRasterizeDialog = (layer, callback) => {
                // Store callback reference for the dialog
                this.rasterizeLayerId = layer.id;
                this.rasterizeCallback = callback;
                this.showRasterizePrompt = true;
            };

            // Set the width/height so tools can access them
            app.width = this.docWidth;
            app.height = this.docHeight;

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
            app.toolManager.register(HandTool);
            app.toolManager.register(VectorShapeEditTool);
            app.toolManager.register(PenTool);

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

            eventBus.on('layer:added', () => {
                this.updateLayerList();
                this.updateNavigator();
                app.renderer.requestRender();
            });
            eventBus.on('layer:removed', () => {
                this.updateLayerList();
                this.updateNavigator();
                app.renderer.requestRender();
            });
            eventBus.on('layer:selected', (data) => {
                this.activeLayerId = data.layer?.id;
                this.updateLayerControls();
            });
            eventBus.on('layer:updated', () => {
                this.updateLayerList();
                this.updateNavigator();
                app.renderer.requestRender();
            });
            eventBus.on('layer:duplicated', () => {
                this.updateLayerList();
                this.updateNavigator();
                app.renderer.requestRender();
            });
            eventBus.on('layer:merged', () => {
                this.updateLayerList();
                this.updateNavigator();
                app.renderer.requestRender();
            });
            eventBus.on('layer:flattened', () => {
                this.updateLayerList();
                this.updateNavigator();
                app.renderer.requestRender();
            });
            eventBus.on('layer:moved', () => {
                this.updateLayerList();
                app.renderer.requestRender();
            });
            eventBus.on('layers:restored', () => {
                this.updateLayerList();
                this.updateNavigator();
            });
            eventBus.on('layers:changed', () => {
                this.updateLayerList();
                this.updateNavigator();
                app.renderer.requestRender();
            });

            // Update history state when history changes
            eventBus.on('history:changed', () => {
                this.updateHistoryState();
            });

            // Update navigator when viewport changes
            eventBus.on('viewport:changed', () => {
                this.updateNavigator();
            });

            // Initialize navigator after a short delay to ensure canvas is ready
            setTimeout(() => {
                this.updateNavigator();
            }, 500);

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
            this.updateHistoryState();
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
                    // Load images from all sources
                    for (const source of sources) {
                        const imagesResponse = await fetch(`${this.apiBase}/images/${source.id}`);
                        if (imagesResponse.ok) {
                            const images = await imagesResponse.json();
                            // Store for File menu (first source only)
                            if (!this.sampleImages.length) {
                                this.sampleImages = images.map(img => ({
                                    id: img.id,
                                    name: img.name,
                                    source: source.id,
                                }));
                            }
                            // Store for Sources panel
                            this.imageSources[source.id] = images.map(img => ({
                                id: img.id,
                                name: img.name,
                            }));
                            // Expand first source by default
                            if (!Object.keys(this.expandedSources).length) {
                                this.expandedSources[source.id] = true;
                            }
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
                group: t.constructor.group || null,
            }));
            this.buildToolGroups();
        },

        buildToolGroups() {
            // Define tool groupings
            // Select tool is first and global (not nested)
            const groupDefs = [
                { id: 'select', name: 'Select', shortcut: 'v', tools: ['select'] },
                { id: 'selection', name: 'Selection', shortcut: 'm', tools: ['selection'] },
                { id: 'freeform', name: 'Freeform Selection', shortcut: 'l', tools: ['lasso'] },
                { id: 'quicksel', name: 'Quick Selection', shortcut: 'w', tools: ['magicwand'] },
                { id: 'crop', name: 'Crop', shortcut: 'c', tools: ['crop'] },
                { id: 'move', name: 'Move', shortcut: null, tools: ['move'] },
                { id: 'hand', name: 'Hand', shortcut: 'h', tools: ['hand'] },
                { id: 'brush', name: 'Brush', shortcut: 'b', tools: ['brush', 'spray'] },
                { id: 'eraser', name: 'Eraser', shortcut: 'e', tools: ['eraser'] },
                { id: 'pen', name: 'Pen', shortcut: 'p', tools: ['pen'] },
                { id: 'shapes', name: 'Shapes', shortcut: 'u', tools: ['rect', 'circle', 'polygon', 'line', 'shape'] },
                { id: 'fill', name: 'Fill', shortcut: 'g', tools: ['fill', 'gradient'] },
                { id: 'text', name: 'Text', shortcut: 't', tools: ['text'] },
                { id: 'eyedropper', name: 'Eyedropper', shortcut: 'i', tools: ['eyedropper'] },
            ];

            const toolsMap = new Map(this.tools.map(t => [t.id, t]));
            this.toolGroups = [];

            for (const def of groupDefs) {
                const groupTools = def.tools
                    .map(id => toolsMap.get(id))
                    .filter(t => t);
                if (groupTools.length > 0) {
                    this.toolGroups.push({
                        id: def.id,
                        name: def.name,
                        shortcut: def.shortcut,
                        tools: groupTools,
                    });
                    // Set default active tool for group
                    if (!this.activeGroupTools[def.id]) {
                        this.activeGroupTools[def.id] = groupTools[0].id;
                    }
                }
            }

            // Add ungrouped tools
            const groupedToolIds = new Set(groupDefs.flatMap(g => g.tools));
            const ungroupedTools = this.tools.filter(t => !groupedToolIds.has(t.id));
            for (const tool of ungroupedTools) {
                this.toolGroups.push({
                    id: `single-${tool.id}`,
                    name: tool.name,
                    shortcut: tool.shortcut,
                    tools: [tool],
                });
                this.activeGroupTools[`single-${tool.id}`] = tool.id;
            }
        },

        // Tool group methods
        isToolGroupActive(group) {
            return group.tools.some(t => t.id === this.currentToolId);
        },

        getActiveToolInGroup(group) {
            const activeId = this.activeGroupTools[group.id];
            return group.tools.find(t => t.id === activeId) || group.tools[0];
        },

        selectToolFromGroup(group) {
            const tool = this.getActiveToolInGroup(group);
            this.selectTool(tool.id);
            this.closeToolFlyout();
        },

        // Tool flyout on hover
        showToolFlyout(group) {
            if (group.tools.length <= 1) return;
            this.cancelCloseFlyout();
            this.activeToolFlyout = group.id;
        },

        scheduleCloseFlyout() {
            this.flyoutCloseTimeout = setTimeout(() => {
                this.activeToolFlyout = null;
            }, 200);
        },

        cancelCloseFlyout() {
            if (this.flyoutCloseTimeout) {
                clearTimeout(this.flyoutCloseTimeout);
                this.flyoutCloseTimeout = null;
            }
        },

        closeToolFlyout() {
            this.cancelCloseFlyout();
            this.activeToolFlyout = null;
        },

        selectToolFromFlyout(group, tool) {
            this.activeGroupTools[group.id] = tool.id;
            this.selectTool(tool.id);
            this.closeToolFlyout();
        },

        // Cycle through tools in a group (Shift+shortcut)
        cycleToolInGroup(shortcut) {
            const group = this.toolGroups.find(g => g.shortcut === shortcut);
            if (!group || group.tools.length <= 1) return false;

            const currentActiveId = this.activeGroupTools[group.id];
            const currentIndex = group.tools.findIndex(t => t.id === currentActiveId);
            const nextIndex = (currentIndex + 1) % group.tools.length;
            const nextTool = group.tools[nextIndex];

            this.activeGroupTools[group.id] = nextTool.id;
            this.selectTool(nextTool.id);
            return true;
        },

        // Color picker popup methods
        openColorPicker(target, event) {
            this.colorPickerTarget = target;
            this.hexInput = target === 'fg' ? this.fgColor : this.bgColor;
            // Position popup below the clicked swatch
            if (event) {
                const rect = event.target.getBoundingClientRect();
                this.colorPickerPosition = {
                    top: (rect.bottom + 5) + 'px',
                    left: rect.left + 'px'
                };
            }
            this.colorPickerVisible = true;
        },

        closeColorPicker() {
            this.colorPickerVisible = false;
        },

        setPickerColor(color) {
            if (this.colorPickerTarget === 'fg') {
                this.setForegroundColor(color);
            } else {
                this.setBackgroundColor(color);
            }
            this.hexInput = color;
        },

        // History methods
        updateHistoryState() {
            try {
                const app = this.getState();
                if (!app?.history) return;

                const entries = app.history.getEntries() || [];
                this.historyList = entries.map(entry => ({
                    name: entry.name || 'Action',
                    icon: this.getHistoryIcon(entry.type),
                    isCurrent: entry.isCurrent || false,
                    isFuture: entry.isFuture || false
                }));
                this.historyIndex = app.history.getCurrentIndex();
                this.canUndo = app.history.canUndo();
                this.canRedo = app.history.canRedo();

                // Update memory usage
                const memInfo = app.history.getMemoryUsage();
                this.memoryUsedMB = memInfo.usedMB;
                this.memoryMaxMB = memInfo.maxMB;
                this.memoryPercent = Math.min(100, memInfo.percentage);

                // Get action names for tooltips
                const undoEntry = app.history.getUndoEntry();
                const redoEntry = app.history.getRedoEntry();
                this.lastUndoAction = undoEntry?.name || '';
                this.lastRedoAction = redoEntry?.name || '';
            } catch (e) {
                console.error('[canvas_editor] Error updating history state:', e);
            }
        },

        getHistoryIcon(type) {
            const icons = {
                'current': '&#9654;',
                'brush': '&#128396;',
                'erase': '&#9986;',
                'fill': '&#128276;',
                'layer': '&#128193;',
                'transform': '&#8689;',
                'filter': '&#9881;',
                'selection': '&#9633;',
                'document': '&#128196;',
            };
            return icons[type] || '&#9679;';
        },

        undo() {
            const app = this.getState();
            if (app?.history?.canUndo()) {
                app.history.undo();
                this.updateHistoryState();
            }
        },

        redo() {
            const app = this.getState();
            if (app?.history?.canRedo()) {
                app.history.redo();
                this.updateHistoryState();
            }
        },

        jumpToHistory(index) {
            const app = this.getState();
            if (!app?.history) return;

            const currentIndex = app.history.getCurrentIndex();
            // Entries are: [undoStack entries] [current state] [redoStack entries]
            // Current state is at index = undoStack.length = currentIndex

            if (index < currentIndex) {
                // Go back (undo) to reach this state
                const steps = currentIndex - index;
                for (let i = 0; i < steps; i++) {
                    app.history.undo();
                }
            } else if (index > currentIndex) {
                // Go forward (redo) to reach this state
                const steps = index - currentIndex;
                for (let i = 0; i < steps; i++) {
                    app.history.redo();
                }
            }
            // If index === currentIndex, we're already there

            this.updateHistoryState();
        },

        // Image sources methods
        async loadImageSources() {
            try {
                const response = await fetch(`${this.apiBase}/images/sources`);
                if (response.ok) {
                    const sources = await response.json();
                    // Load images for each source
                    for (const source of sources) {
                        const imgResponse = await fetch(`${this.apiBase}/images/${source.id}/list`);
                        if (imgResponse.ok) {
                            const images = await imgResponse.json();
                            this.imageSources[source.id] = images;
                            this.expandedSources[source.id] = source.id === 'skimage'; // Expand skimage by default
                        }
                    }
                }
            } catch (e) {
                console.warn('Failed to load image sources:', e);
            }
        },

        toggleSourceCategory(source) {
            this.expandedSources[source] = !this.expandedSources[source];
        },

        formatSourceName(source) {
            const names = {
                'skimage': 'scikit-image Samples',
                'wikimedia': 'Wikimedia Commons',
                'unsplash': 'Unsplash',
            };
            return names[source] || source;
        },

        async loadSourceImage(source, img) {
            try {
                const response = await fetch(`${this.apiBase}/images/${source}/${img.id}`);
                if (response.ok) {
                    const metadata = await response.json();
                    // Load as new layer
                    await this.loadSampleImage({ id: img.id, source, ...metadata });
                    this.statusMessage = `Loaded: ${img.name}`;
                }
            } catch (e) {
                console.error('Failed to load image:', e);
                this.statusMessage = 'Failed to load image';
            }
        },

        // View menu methods
        showViewMenu(e) {
            this.showMenu('view', e);
        },

        toggleViewOption(option) {
            this[option] = !this[option];
            if (option === 'showNavigator' && this[option]) {
                this.$nextTick(() => this.updateNavigator());
            }
        },

        toggleNavigator() {
            this.showNavigator = !this.showNavigator;
        },

        // Navigator methods
        updateNavigator() {
            const app = this.getState();
            if (!app?.renderer || !app?.layerStack || !this.$refs.navigatorCanvas) return;
            if (!this.showNavigator) return;

            const canvas = this.$refs.navigatorCanvas;
            const ctx = canvas.getContext('2d');
            const maxSize = 180;

            // Calculate scale to fit navigator
            const docWidth = app.renderer.compositeCanvas?.width || this.docWidth;
            const docHeight = app.renderer.compositeCanvas?.height || this.docHeight;
            const scale = Math.min(maxSize / docWidth, maxSize / docHeight);

            canvas.width = Math.ceil(docWidth * scale);
            canvas.height = Math.ceil(docHeight * scale);

            // Draw transparency pattern background
            ctx.fillStyle = '#444';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw checkerboard
            const gridSize = 8;
            ctx.fillStyle = '#555';
            for (let y = 0; y < canvas.height; y += gridSize) {
                for (let x = 0; x < canvas.width; x += gridSize) {
                    if ((Math.floor(x / gridSize) + Math.floor(y / gridSize)) % 2 === 0) {
                        ctx.fillRect(x, y, gridSize, gridSize);
                    }
                }
            }

            // Draw layers
            for (const layer of app.layerStack.layers) {
                if (!layer.visible) continue;
                ctx.globalAlpha = layer.opacity;
                ctx.drawImage(layer.canvas, 0, 0, canvas.width, canvas.height);
            }
            ctx.globalAlpha = 1;

            // Calculate viewport rectangle
            const displayCanvas = this.$refs.mainCanvas;
            const renderer = app.renderer;

            // The viewport in document coordinates
            const viewportLeft = -renderer.panX / renderer.zoom;
            const viewportTop = -renderer.panY / renderer.zoom;
            const viewportWidth = displayCanvas.width / renderer.zoom;
            const viewportHeight = displayCanvas.height / renderer.zoom;

            // Convert to navigator coordinates
            const viewX = viewportLeft * scale;
            const viewY = viewportTop * scale;
            const viewW = viewportWidth * scale;
            const viewH = viewportHeight * scale;

            // Draw viewport rectangle
            ctx.strokeStyle = '#ff3333';
            ctx.lineWidth = 2;
            ctx.strokeRect(
                Math.max(0, viewX),
                Math.max(0, viewY),
                Math.min(viewW, canvas.width - Math.max(0, viewX)),
                Math.min(viewH, canvas.height - Math.max(0, viewY))
            );

            // Draw full rectangle outline if partially visible
            ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
            ctx.lineWidth = 1;
            ctx.strokeRect(viewX, viewY, viewW, viewH);
        },

        navigatorMouseDown(e) {
            this.navigatorDragging = true;
            this.navigatorPan(e);
        },

        navigatorMouseMove(e) {
            if (this.navigatorDragging) {
                this.navigatorPan(e);
            }
        },

        navigatorMouseUp() {
            this.navigatorDragging = false;
        },

        navigatorPan(e) {
            const app = this.getState();
            if (!app?.renderer || !this.$refs.navigatorCanvas) return;

            const canvas = this.$refs.navigatorCanvas;
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Calculate scale (same as in updateNavigator)
            const docWidth = app.renderer.compositeCanvas?.width || this.docWidth;
            const docHeight = app.renderer.compositeCanvas?.height || this.docHeight;
            const maxSize = 180;
            const scale = Math.min(maxSize / docWidth, maxSize / docHeight);

            // Convert navigator coordinates to document coordinates
            const docX = x / scale;
            const docY = y / scale;

            // Center the viewport on the clicked point
            const displayCanvas = this.$refs.mainCanvas;
            const viewW = displayCanvas.width / app.renderer.zoom;
            const viewH = displayCanvas.height / app.renderer.zoom;

            app.renderer.panX = -(docX - viewW / 2) * app.renderer.zoom;
            app.renderer.panY = -(docY - viewH / 2) * app.renderer.zoom;
            app.renderer.requestRender();
            this.updateNavigator();
        },

        setZoomPercent(percent) {
            const app = this.getState();
            if (!app?.renderer) return;
            const newZoom = parseInt(percent) / 100;
            const canvas = this.$refs.mainCanvas;
            app.renderer.zoomAt(newZoom / app.renderer.zoom, canvas.width / 2, canvas.height / 2);
            this.zoom = app.renderer.zoom;
            this.updateNavigator();
        },

        startPanelDrag(panelId, event) {
            // Placeholder for future panel dragging functionality
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
                isVector: l.isVector ? l.isVector() : false,
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

        // Submenu handling
        openSubmenu(category, event) {
            this.cancelSubmenuClose();
            this.activeSubmenu = category;
            const rect = event.target.getBoundingClientRect();
            this.submenuPosition = {
                top: rect.top + 'px',
                left: (rect.right + 2) + 'px'
            };
        },

        closeSubmenuDelayed() {
            this.submenuCloseTimeout = setTimeout(() => {
                this.activeSubmenu = null;
            }, 150);
        },

        cancelSubmenuClose() {
            if (this.submenuCloseTimeout) {
                clearTimeout(this.submenuCloseTimeout);
                this.submenuCloseTimeout = null;
            }
        },

        // Filter dialog methods
        openFilterDialog(filter) {
            this.activeMenu = null;
            this.activeSubmenu = null;

            // Check if filter has parameters
            const hasParams = filter.params && filter.params.length > 0;

            if (!hasParams) {
                // Apply directly without dialog
                this.applyFilterDirect(filter);
                return;
            }

            // Initialize params with defaults
            this.filterParams = {};
            for (const param of filter.params) {
                this.filterParams[param.id] = param.default !== undefined ? param.default :
                    (param.type === 'range' ? param.min :
                     param.type === 'select' ? param.options[0] :
                     param.type === 'checkbox' ? false : '');
            }

            this.currentFilter = filter;
            this.filterDialogVisible = true;
            this.filterPreviewEnabled = true;
            this.filterPreviewState = null;

            // Save current state for preview/cancel, then apply initial preview
            this.$nextTick(() => {
                this.saveFilterPreviewState();
                // Small delay to ensure state is saved before preview
                setTimeout(() => {
                    this.updateFilterPreview();
                }, 50);
            });
        },

        saveFilterPreviewState() {
            const app = this.getState();
            const layer = app?.layerStack?.getActiveLayer();
            if (layer) {
                this.filterPreviewState = layer.ctx.getImageData(0, 0, layer.width, layer.height);
            }
        },

        restoreFilterPreviewState(render = true) {
            const app = this.getState();
            const layer = app?.layerStack?.getActiveLayer();
            if (layer && this.filterPreviewState) {
                layer.ctx.putImageData(this.filterPreviewState, 0, 0);
                if (render) {
                    app.renderer.requestRender();
                }
            }
        },

        toggleFilterPreview() {
            if (this.filterPreviewEnabled) {
                this.updateFilterPreview();
            } else {
                this.restoreFilterPreviewState();
            }
        },

        async updateFilterPreview() {
            if (!this.filterPreviewEnabled || !this.currentFilter) return;

            // Debounce preview updates
            if (this.filterPreviewDebounce) {
                clearTimeout(this.filterPreviewDebounce);
            }

            this.filterPreviewDebounce = setTimeout(async () => {
                const app = this.getState();
                if (!app || !this.filterPreviewState) return;

                try {
                    // Restore original state first (don't render yet)
                    this.restoreFilterPreviewState(false);

                    // Apply filter with current params and render
                    await this.applyFilterToLayer(this.currentFilter.id, this.filterParams, true);
                } catch (error) {
                    console.error('Preview error:', error);
                    // On error, restore and render original
                    this.restoreFilterPreviewState(true);
                }
            }, 150);
        },

        async applyFilterDirect(filter) {
            const app = this.getState();
            if (!app) return;

            app.history.saveState('Filter: ' + filter.name);
            this.statusMessage = 'Applying ' + filter.name + '...';

            try {
                await this.applyFilterToLayer(filter.id, {}, true);
                app.history.finishState();
                this.statusMessage = filter.name + ' applied';
            } catch (error) {
                console.error('Filter error:', error);
                app.history.abortCapture();
                this.statusMessage = 'Filter failed: ' + error.message;
            }
        },

        async applyFilterConfirm() {
            const app = this.getState();
            if (!app || !this.currentFilter) return;

            // The preview is already applied, just save to history
            app.history.saveState('Filter: ' + this.currentFilter.name);
            app.history.finishState();

            this.statusMessage = this.currentFilter.name + ' applied';
            this.filterDialogVisible = false;
            this.currentFilter = null;
            this.filterPreviewState = null;
        },

        cancelFilterDialog() {
            // Restore original state
            this.restoreFilterPreviewState();

            this.filterDialogVisible = false;
            this.currentFilter = null;
            this.filterPreviewState = null;
            this.statusMessage = 'Filter cancelled';
        },

        // Rasterize dialog methods
        confirmRasterize() {
            const app = this.getState();
            if (!app || !this.rasterizeLayerId) {
                this.cancelRasterize();
                return;
            }

            // Save state before rasterizing
            app.history.saveState('Rasterize Layer');

            // Rasterize the layer
            app.layerStack.rasterizeLayer(this.rasterizeLayerId);
            app.renderer.requestRender();

            app.history.finishState();

            // Update layers display
            this.updateLayers();

            // Call the callback
            const callback = this.rasterizeCallback;
            this.showRasterizePrompt = false;
            this.rasterizeLayerId = null;
            this.rasterizeCallback = null;

            if (callback) {
                callback(true);
            }
        },

        cancelRasterize() {
            const callback = this.rasterizeCallback;
            this.showRasterizePrompt = false;
            this.rasterizeLayerId = null;
            this.rasterizeCallback = null;

            if (callback) {
                callback(false);
            }
        },

        async applyFilterToLayer(filterId, params, renderAfter = true) {
            const app = this.getState();
            const layer = app?.layerStack?.getActiveLayer();
            if (!layer) return;

            const imageData = layer.ctx.getImageData(0, 0, layer.width, layer.height);

            // Create binary payload
            const metadata = JSON.stringify({
                width: imageData.width,
                height: imageData.height,
                params: params
            });
            const metadataBytes = new TextEncoder().encode(metadata);
            const metadataLength = new Uint32Array([metadataBytes.length]);

            const payload = new Uint8Array(4 + metadataBytes.length + imageData.data.length);
            payload.set(new Uint8Array(metadataLength.buffer), 0);
            payload.set(metadataBytes, 4);
            payload.set(imageData.data, 4 + metadataBytes.length);

            const response = await fetch(`${this.apiBase}/filters/${filterId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/octet-stream' },
                body: payload
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
                throw new Error(error.detail || 'Filter failed');
            }

            const resultBytes = new Uint8Array(await response.arrayBuffer());
            const resultImageData = new ImageData(
                new Uint8ClampedArray(resultBytes),
                imageData.width,
                imageData.height
            );

            layer.ctx.putImageData(resultImageData, 0, 0);

            if (renderAfter) {
                app.renderer.requestRender();
            }
        },

        getToolIcon(icon) {
            const icons = {
                'selection': '&#9633;',    // White square (selection)
                'lasso': '&#10551;',       // Lasso curve
                'magicwand': '&#10022;',   // Star/wand
                'move': '&#8689;',         // Move arrows
                'cursor': '&#10146;',      // Arrow cursor (shape edit)
                'pen': '&#9998;',          // Pen (bezier path)
                'hand': '&#9995;',         // Hand (pan)
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
                this.setPickerColor(hex);
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
            // Note: Adding layer is a structural change
            app.history.saveState('New Layer');
            app.layerStack.addLayer({ name: `Layer ${app.layerStack.layers.length + 1}` });
            app.history.finishState();
        },

        deleteLayer() {
            const app = this.getState();
            if (!app?.layerStack) return;

            // Note: Deleting layer is a structural change
            app.history.saveState('Delete Layer');

            // If only one layer, delete it and create a new transparent one
            if (app.layerStack.layers.length <= 1) {
                app.layerStack.layers = [];
                app.layerStack.activeLayerIndex = -1;
                const newLayer = app.layerStack.addLayer({ name: 'Layer 1' });
                // Leave transparent (don't fill with white)
            } else {
                app.layerStack.removeLayer(app.layerStack.activeLayerIndex);
            }
            app.history.finishState();
        },

        duplicateLayer() {
            const app = this.getState();
            if (!app?.layerStack) return;
            // Note: Duplicating layer is a structural change
            app.history.saveState('Duplicate Layer');
            app.layerStack.duplicateLayer(app.layerStack.activeLayerIndex);
            app.history.finishState();
        },

        mergeDown() {
            const app = this.getState();
            if (!app?.layerStack) return;
            if (app.layerStack.activeLayerIndex <= 0) return; // Can't merge bottom layer
            // Merge modifies pixels in bottom layer
            app.history.saveState('Merge Layers');
            app.layerStack.mergeDown(app.layerStack.activeLayerIndex);
            app.history.finishState();
        },

        // Zoom
        zoomIn() {
            const app = this.getState();
            if (!app?.renderer) return;
            const canvas = this.$refs.mainCanvas;
            app.renderer.zoomAt(1.25, canvas.width / 2, canvas.height / 2);
            this.zoom = app.renderer.zoom;
            this.updateNavigator();
        },

        zoomOut() {
            const app = this.getState();
            if (!app?.renderer) return;
            const canvas = this.$refs.mainCanvas;
            app.renderer.zoomAt(0.8, canvas.width / 2, canvas.height / 2);
            this.zoom = app.renderer.zoom;
            this.updateNavigator();
        },

        fitToView() {
            const app = this.getState();
            if (!app?.renderer) return;
            app.renderer.fitToViewport();
            this.zoom = app.renderer.zoom;
            this.updateNavigator();
        },

        // Menus
        showFileMenu(e) {
            this.showMenu('file', e);
        },
        showEditMenu(e) {
            this.updateHistoryState(); // Refresh history state for menu
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
            this.colorPickerVisible = false;
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
                    app?.history?.saveState('Flatten Image');
                    app?.layerStack?.flattenAll();
                    this.updateLayerList();
                    break;
                case 'zoom_in':
                    this.zoomIn();
                    this.updateNavigator();
                    break;
                case 'zoom_out':
                    this.zoomOut();
                    this.updateNavigator();
                    break;
                case 'zoom_fit':
                    this.fitToView();
                    this.updateNavigator();
                    break;
                case 'zoom_100':
                    this.setZoomPercent(100);
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

            const tool = app.toolManager.currentTool;
            tool?.onMouseDown(e, x, y);
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
                this.updateNavigator();
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
            this.updateNavigator();
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
                            this.redo();
                        } else {
                            this.undo();
                        }
                        return;
                    case 'y':
                        e.preventDefault();
                        this.redo();
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

                // Shift+key cycles through tools in the same group
                if (e.shiftKey) {
                    const lowerKey = e.key.toLowerCase();
                    if (this.cycleToolInGroup(lowerKey)) {
                        return;
                    }
                }

                // Regular tool shortcuts
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
            if (!app) return;

            // Clear pixel selection
            const selectionTool = app.toolManager?.tools.get('selection');
            selectionTool?.clearSelection();

            // Clear vector shape selection
            const layer = app.layerStack?.getActiveLayer();
            if (layer?.isVector?.()) {
                layer.clearSelection();
                layer.render();
                app.renderer.requestRender();
            }
        },

        deleteSelection() {
            const app = this.getState();
            if (!app) return;

            const layer = app.layerStack.getActiveLayer();
            if (!layer || layer.locked) return;

            // Handle vector layer - delete selected shapes
            if (layer.isVector?.()) {
                const selectedIds = [...layer.selectedShapeIds];
                if (selectedIds.length > 0) {
                    app.history.saveState('Delete Shapes');
                    for (const id of selectedIds) {
                        layer.removeShape(id);
                    }
                    app.history.finishState();
                    app.renderer.requestRender();
                    return;
                }
            }

            // Handle pixel layer - delete selection area
            const selection = this.getSelection();
            if (selection && selection.width > 0 && selection.height > 0) {
                app.history.saveState('Delete Selection');
                layer.ctx.clearRect(
                    Math.floor(selection.x),
                    Math.floor(selection.y),
                    Math.ceil(selection.width),
                    Math.ceil(selection.height)
                );
                app.history.finishState();
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
                        app.history.saveState('Flatten Image');
                        app.layerStack.flattenAll();
                        app.history.finishState();
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
                        // Note: Tool's onMouseDown/onMouseUp handle history
                        if (!params.points || params.points.length < 2) {
                            return { success: false, error: 'Need at least 2 points for stroke' };
                        }
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
                        // Note: Tool's onMouseDown handles history
                        if (params.point) {
                            tool.onMouseDown({ button: 0 }, params.point[0], params.point[1]);
                            tool.onMouseUp({ button: 0 }, params.point[0], params.point[1]);
                            app.renderer.requestRender();
                        }
                        break;

                    case 'translate':
                        // Move layer directly (not using tool)
                        if (params.dx !== undefined && params.dy !== undefined) {
                            app.history.saveState('Move');
                            const ctx = layer.ctx;
                            const imageData = ctx.getImageData(0, 0, this.docWidth, this.docHeight);
                            ctx.clearRect(0, 0, this.docWidth, this.docHeight);
                            ctx.putImageData(imageData, params.dx, params.dy);
                            app.history.finishState();
                            app.renderer.requestRender();
                        }
                        break;

                    case 'draw':
                        // Draw shape - fallback for tools without executeAction
                        // Note: Tool's onMouseDown/onMouseUp handle history
                        if (params.start && params.end) {
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
