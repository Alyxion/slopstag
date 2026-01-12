/**
 * LayerPanel - Layer list and management UI.
 */
import { BlendModes } from '../core/BlendModes.js';

export class LayerPanel {
    /**
     * @param {Object} app - Application reference
     */
    constructor(app) {
        this.app = app;
        this.container = document.getElementById('layer-panel');
        this.render();
        this.bindEvents();
    }

    render() {
        this.container.innerHTML = `
            <div class="panel-header">
                <span>Layers</span>
            </div>
            <div class="layer-controls">
                <select id="blend-mode" class="layer-blend-mode">
                    ${BlendModes.getAllModes().map(m =>
                        `<option value="${m.id}">${m.name}</option>`
                    ).join('')}
                </select>
                <div class="layer-opacity-row">
                    <label>Opacity:</label>
                    <input type="range" id="layer-opacity" min="0" max="100" value="100">
                    <span id="layer-opacity-value">100%</span>
                </div>
            </div>
            <div class="layer-list" id="layer-list"></div>
            <div class="layer-buttons">
                <button id="layer-add" title="Add Layer">+</button>
                <button id="layer-delete" title="Delete Layer">-</button>
                <button id="layer-duplicate" title="Duplicate Layer">D</button>
                <button id="layer-merge" title="Merge Down">M</button>
            </div>
        `;

        this.renderLayerList();
    }

    renderLayerList() {
        const list = document.getElementById('layer-list');
        if (!list) return;

        const layers = this.app.layerStack.layers;
        const activeIndex = this.app.layerStack.activeLayerIndex;

        // Render from top to bottom (reverse order)
        list.innerHTML = layers.slice().reverse().map((layer, reverseIdx) => {
            const idx = layers.length - 1 - reverseIdx;
            const isActive = idx === activeIndex;
            return `
                <div class="layer-item ${isActive ? 'active' : ''}" data-index="${idx}">
                    <button class="layer-visibility ${layer.visible ? 'visible' : ''}"
                            data-action="toggle-visibility" data-index="${idx}">
                        ${layer.visible ? '👁' : '○'}
                    </button>
                    <span class="layer-name">${layer.name}</span>
                    ${layer.locked ? '<span class="layer-locked">🔒</span>' : ''}
                </div>
            `;
        }).join('');
    }

    bindEvents() {
        // Layer list clicks
        this.container.addEventListener('click', (e) => {
            const layerItem = e.target.closest('.layer-item');
            const action = e.target.dataset.action;

            if (action === 'toggle-visibility') {
                const idx = parseInt(e.target.dataset.index);
                const layer = this.app.layerStack.layers[idx];
                if (layer) {
                    layer.visible = !layer.visible;
                    this.renderLayerList();
                    this.app.renderer.requestRender();
                }
                e.stopPropagation();
            } else if (layerItem) {
                const idx = parseInt(layerItem.dataset.index);
                this.app.layerStack.setActiveLayer(idx);
                this.renderLayerList();
                this.updateControls();
            }
        });

        // Blend mode
        document.getElementById('blend-mode')?.addEventListener('change', (e) => {
            const layer = this.app.layerStack.getActiveLayer();
            if (layer) {
                layer.blendMode = e.target.value;
                this.app.renderer.requestRender();
            }
        });

        // Opacity
        document.getElementById('layer-opacity')?.addEventListener('input', (e) => {
            const layer = this.app.layerStack.getActiveLayer();
            if (layer) {
                layer.opacity = parseInt(e.target.value) / 100;
                document.getElementById('layer-opacity-value').textContent = `${e.target.value}%`;
                this.app.renderer.requestRender();
            }
        });

        // Layer buttons
        document.getElementById('layer-add')?.addEventListener('click', () => {
            this.app.layerStack.addLayer({ name: `Layer ${this.app.layerStack.layers.length + 1}` });
            this.renderLayerList();
        });

        document.getElementById('layer-delete')?.addEventListener('click', () => {
            this.app.history.saveState('delete layer');
            this.app.layerStack.removeLayer(this.app.layerStack.activeLayerIndex);
            this.renderLayerList();
            this.app.renderer.requestRender();
        });

        document.getElementById('layer-duplicate')?.addEventListener('click', () => {
            this.app.history.saveState('duplicate layer');
            this.app.layerStack.duplicateLayer(this.app.layerStack.activeLayerIndex);
            this.renderLayerList();
            this.app.renderer.requestRender();
        });

        document.getElementById('layer-merge')?.addEventListener('click', () => {
            this.app.history.saveState('merge layer');
            this.app.layerStack.mergeDown(this.app.layerStack.activeLayerIndex);
            this.renderLayerList();
            this.app.renderer.requestRender();
        });

        // Event listeners
        this.app.eventBus.on('layer:added', () => this.update());
        this.app.eventBus.on('layer:removed', () => this.update());
        this.app.eventBus.on('layer:activated', () => this.update());
        this.app.eventBus.on('layers:restored', () => this.update());
    }

    updateControls() {
        const layer = this.app.layerStack.getActiveLayer();
        if (!layer) return;

        const blendSelect = document.getElementById('blend-mode');
        const opacitySlider = document.getElementById('layer-opacity');
        const opacityValue = document.getElementById('layer-opacity-value');

        if (blendSelect) blendSelect.value = layer.blendMode;
        if (opacitySlider) opacitySlider.value = Math.round(layer.opacity * 100);
        if (opacityValue) opacityValue.textContent = `${Math.round(layer.opacity * 100)}%`;
    }

    update() {
        this.renderLayerList();
        this.updateControls();
    }
}
