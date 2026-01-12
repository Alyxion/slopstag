/**
 * BrushTool - Freehand painting with configurable brush.
 */
import { Tool } from './Tool.js';
import { BrushPresets, DEFAULT_PRESET, getPreset } from '../data/BrushPresets.js';

export class BrushTool extends Tool {
    static id = 'brush';
    static name = 'Brush';
    static icon = 'brush';
    static shortcut = 'b';
    static cursor = 'crosshair';

    constructor(app) {
        super(app);

        // Brush properties
        this.size = 20;
        this.hardness = 100; // 0-100, affects edge softness
        this.opacity = 100;  // 0-100
        this.flow = 100;     // 0-100, affects buildup
        this.currentPreset = DEFAULT_PRESET;

        // Apply default preset
        this.applyPreset(DEFAULT_PRESET);

        // State
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;

        // Brush stamp cache
        this.brushStamp = null;
        this.stampColor = '#000000';
        this.updateBrushStamp();
    }

    applyPreset(presetId) {
        const preset = getPreset(presetId);
        if (preset) {
            this.size = preset.size;
            this.hardness = preset.hardness;
            this.opacity = preset.opacity;
            this.flow = preset.flow;
            this.currentPreset = presetId;
            this.updateBrushStamp();
        }
    }

    updateBrushStamp() {
        // Use higher resolution for better anti-aliasing, minimum 2x for small brushes
        const baseSize = Math.max(1, Math.ceil(this.size));
        const scale = baseSize < 10 ? 4 : (baseSize < 20 ? 2 : 1);
        const size = baseSize * scale;

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Enable anti-aliasing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        const radius = size / 2;
        const hardness = this.hardness / 100;

        // Parse color from app
        const color = this.app.foregroundColor || '#000000';
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        if (hardness >= 0.99) {
            // Hard brush - draw a proper anti-aliased circle
            ctx.beginPath();
            ctx.arc(radius, radius, radius - 0.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fill();
        } else {
            // Soft brush - use radial gradient with smooth falloff
            const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
            const coreSize = hardness;

            // Add more color stops for smoother gradient
            gradient.addColorStop(0, `rgba(${r},${g},${b},1)`);
            gradient.addColorStop(coreSize * 0.5, `rgba(${r},${g},${b},1)`);
            gradient.addColorStop(coreSize, `rgba(${r},${g},${b},0.9)`);
            gradient.addColorStop(coreSize + (1 - coreSize) * 0.3, `rgba(${r},${g},${b},0.5)`);
            gradient.addColorStop(coreSize + (1 - coreSize) * 0.6, `rgba(${r},${g},${b},0.2)`);
            gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);

            // Draw as a circle, not a rectangle
            ctx.beginPath();
            ctx.arc(radius, radius, radius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
        }

        // If we upscaled, create the final stamp at the correct size
        if (scale > 1) {
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = baseSize;
            finalCanvas.height = baseSize;
            const finalCtx = finalCanvas.getContext('2d');
            finalCtx.imageSmoothingEnabled = true;
            finalCtx.imageSmoothingQuality = 'high';
            finalCtx.drawImage(canvas, 0, 0, baseSize, baseSize);
            this.brushStamp = finalCanvas;
        } else {
            this.brushStamp = canvas;
        }

        this.stampColor = color;
    }

    onMouseDown(e, x, y) {
        const layer = this.app.layerStack.getActiveLayer();
        if (!layer || layer.locked) return;

        // Check if this is a vector layer - offer to rasterize
        if (layer.isVector && layer.isVector()) {
            this.app.showRasterizeDialog(layer, (confirmed) => {
                if (confirmed) {
                    // Layer has been rasterized, start drawing
                    this.startDrawing(e, x, y);
                }
            });
            return;
        }

        this.startDrawing(e, x, y);
    }

    startDrawing(e, x, y) {
        const layer = this.app.layerStack.getActiveLayer();
        if (!layer || layer.locked) return;

        // Check if color changed
        if (this.stampColor !== this.app.foregroundColor) {
            this.updateBrushStamp();
        }

        this.isDrawing = true;
        this.lastX = x;
        this.lastY = y;

        // Save state for undo - history system auto-detects changed region
        this.app.history.saveState('Brush Stroke');

        // Draw initial stamp
        this.drawStamp(layer, x, y);
        this.app.renderer.requestRender();
    }

    onMouseMove(e, x, y) {
        if (!this.isDrawing) return;

        const layer = this.app.layerStack.getActiveLayer();
        if (!layer || layer.locked) return;

        // Interpolate between last position and current
        this.drawLine(layer, this.lastX, this.lastY, x, y);

        this.lastX = x;
        this.lastY = y;
        this.app.renderer.requestRender();
    }

    onMouseUp(e, x, y) {
        if (this.isDrawing) {
            this.isDrawing = false;
            // Finish history capture - auto-detects changed pixels
            this.app.history.finishState();
        }
    }

    onMouseLeave(e) {
        if (this.isDrawing) {
            this.isDrawing = false;
            // Finish history capture even if mouse leaves
            this.app.history.finishState();
        }
    }

    drawStamp(layer, x, y) {
        const halfSize = this.size / 2;

        // Expand layer if needed to include the brush area
        if (layer.expandToInclude) {
            layer.expandToInclude(
                x - halfSize,
                y - halfSize,
                this.size,
                this.size
            );
        }

        // Convert document coordinates to layer canvas coordinates
        let canvasX = x, canvasY = y;
        if (layer.docToCanvas) {
            const canvasCoords = layer.docToCanvas(x, y);
            canvasX = canvasCoords.x;
            canvasY = canvasCoords.y;
        }

        layer.ctx.globalAlpha = (this.opacity / 100) * (this.flow / 100);
        layer.ctx.drawImage(this.brushStamp, canvasX - halfSize, canvasY - halfSize);
        layer.ctx.globalAlpha = 1.0;
    }

    drawLine(layer, x1, y1, x2, y2) {
        const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const spacing = Math.max(1, this.size * 0.25);
        const steps = Math.max(1, Math.ceil(distance / spacing));

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = x1 + (x2 - x1) * t;
            const y = y1 + (y2 - y1) * t;
            this.drawStamp(layer, x, y);
        }
    }

    onPropertyChanged(id, value) {
        if (id === 'preset') {
            this.applyPreset(value);
        } else if (id === 'size' || id === 'hardness') {
            this[id] = value;
            this.updateBrushStamp();
        } else if (id === 'opacity' || id === 'flow') {
            this[id] = value;
        }
    }

    getProperties() {
        return [
            {
                id: 'preset',
                name: 'Preset',
                type: 'select',
                options: BrushPresets.map(p => ({ value: p.id, label: p.name })),
                value: this.currentPreset
            },
            { id: 'size', name: 'Size', type: 'range', min: 1, max: 200, step: 1, value: this.size },
            { id: 'hardness', name: 'Hardness', type: 'range', min: 0, max: 100, step: 1, value: this.hardness },
            { id: 'opacity', name: 'Opacity', type: 'range', min: 1, max: 100, step: 1, value: this.opacity },
            { id: 'flow', name: 'Flow', type: 'range', min: 1, max: 100, step: 1, value: this.flow }
        ];
    }

    // API execution
    executeAction(action, params) {
        const layer = this.app.layerStack.getActiveLayer();
        if (!layer || layer.locked) {
            return { success: false, error: 'No active layer or layer is locked' };
        }

        if (action === 'stroke' && params.points && params.points.length >= 1) {
            // Apply optional parameters
            if (params.size !== undefined) this.size = params.size;
            if (params.hardness !== undefined) this.hardness = params.hardness;
            if (params.opacity !== undefined) this.opacity = params.opacity;
            if (params.flow !== undefined) this.flow = params.flow;
            if (params.color) {
                this.app.foregroundColor = params.color;
            }
            this.updateBrushStamp();

            // Save state - history auto-detects changed region
            this.app.history.saveState('Brush Stroke');

            const points = params.points;

            // Draw first point
            this.drawStamp(layer, points[0][0], points[0][1]);

            // Draw lines between consecutive points
            for (let i = 1; i < points.length; i++) {
                this.drawLine(layer, points[i-1][0], points[i-1][1], points[i][0], points[i][1]);
            }

            // Finish state - auto-detects changed pixels
            this.app.history.finishState();

            this.app.renderer.requestRender();
            return { success: true };
        }

        if (action === 'dot' && params.x !== undefined && params.y !== undefined) {
            if (params.size !== undefined) this.size = params.size;
            if (params.color) {
                this.app.foregroundColor = params.color;
            }
            this.updateBrushStamp();

            // Save state - history auto-detects changed region
            this.app.history.saveState('Brush Dot');

            this.drawStamp(layer, params.x, params.y);

            // Finish state - auto-detects changed pixels
            this.app.history.finishState();

            this.app.renderer.requestRender();
            return { success: true };
        }

        return { success: false, error: `Unknown action: ${action}` };
    }
}
