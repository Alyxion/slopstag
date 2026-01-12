/**
 * BrushTool - Freehand painting with configurable brush.
 */
import { Tool } from './Tool.js';

export class BrushTool extends Tool {
    static id = 'brush';
    static name = 'Brush';
    static icon = 'brush';
    static shortcut = 'b';
    static cursor = 'crosshair';

    constructor(app) {
        super(app);

        // Brush properties
        this.size = 10;
        this.hardness = 100; // 0-100, affects edge softness
        this.opacity = 100;  // 0-100
        this.flow = 100;     // 0-100, affects buildup

        // State
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;

        // Brush stamp cache
        this.brushStamp = null;
        this.stampColor = '#000000';
        this.updateBrushStamp();
    }

    updateBrushStamp() {
        const size = Math.max(1, Math.ceil(this.size));
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        const radius = size / 2;
        const hardness = this.hardness / 100;

        // Parse color from app
        const color = this.app.foregroundColor || '#000000';
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        // Create radial gradient for soft brush
        const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);

        if (hardness >= 0.99) {
            // Hard brush - solid circle
            gradient.addColorStop(0, `rgba(${r},${g},${b},1)`);
            gradient.addColorStop(1, `rgba(${r},${g},${b},1)`);
        } else {
            // Soft brush - gradient falloff
            const coreSize = hardness;
            gradient.addColorStop(0, `rgba(${r},${g},${b},1)`);
            gradient.addColorStop(coreSize, `rgba(${r},${g},${b},1)`);
            gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        this.brushStamp = canvas;
        this.stampColor = color;
    }

    onMouseDown(e, x, y) {
        const layer = this.app.layerStack.getActiveLayer();
        if (!layer || layer.locked) return;

        // Check if color changed
        if (this.stampColor !== this.app.foregroundColor) {
            this.updateBrushStamp();
        }

        this.isDrawing = true;
        this.lastX = x;
        this.lastY = y;

        // Save state for undo
        this.app.history.saveState('brush');

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
        this.isDrawing = false;
    }

    onMouseLeave(e) {
        this.isDrawing = false;
    }

    drawStamp(layer, x, y) {
        const offset = this.size / 2;
        layer.ctx.globalAlpha = (this.opacity / 100) * (this.flow / 100);
        layer.ctx.drawImage(this.brushStamp, x - offset, y - offset);
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
        if (id === 'size' || id === 'hardness') {
            this.updateBrushStamp();
        }
    }

    getProperties() {
        return [
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

            this.app.history.saveState('brush_api');

            const points = params.points;
            // Draw first point
            this.drawStamp(layer, points[0][0], points[0][1]);

            // Draw lines between consecutive points
            for (let i = 1; i < points.length; i++) {
                this.drawLine(layer, points[i-1][0], points[i-1][1], points[i][0], points[i][1]);
            }

            this.app.renderer.requestRender();
            return { success: true };
        }

        if (action === 'dot' && params.x !== undefined && params.y !== undefined) {
            if (params.size !== undefined) this.size = params.size;
            if (params.color) {
                this.app.foregroundColor = params.color;
            }
            this.updateBrushStamp();

            this.app.history.saveState('brush_dot');
            this.drawStamp(layer, params.x, params.y);
            this.app.renderer.requestRender();
            return { success: true };
        }

        return { success: false, error: `Unknown action: ${action}` };
    }
}
