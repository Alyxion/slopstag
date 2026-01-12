/**
 * EraserTool - Erase to transparency.
 */
import { Tool } from './Tool.js';

export class EraserTool extends Tool {
    static id = 'eraser';
    static name = 'Eraser';
    static icon = 'eraser';
    static shortcut = 'e';
    static cursor = 'crosshair';

    constructor(app) {
        super(app);

        // Eraser properties
        this.size = 20;
        this.hardness = 100;
        this.opacity = 100;

        // State
        this.isErasing = false;
        this.lastX = 0;
        this.lastY = 0;

        // Eraser stamp cache
        this.eraserStamp = null;
        this.updateEraserStamp();
    }

    updateEraserStamp() {
        const size = Math.max(1, Math.ceil(this.size));
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        const radius = size / 2;
        const hardness = this.hardness / 100;

        // Create radial gradient for soft eraser
        const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);

        if (hardness >= 0.99) {
            gradient.addColorStop(0, 'rgba(0,0,0,1)');
            gradient.addColorStop(1, 'rgba(0,0,0,1)');
        } else {
            const coreSize = hardness;
            gradient.addColorStop(0, 'rgba(0,0,0,1)');
            gradient.addColorStop(coreSize, 'rgba(0,0,0,1)');
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        this.eraserStamp = canvas;
    }

    onMouseDown(e, x, y) {
        const layer = this.app.layerStack.getActiveLayer();
        if (!layer || layer.locked) return;

        this.isErasing = true;
        this.lastX = x;
        this.lastY = y;

        // Save state for undo
        this.app.history.saveState('eraser');

        // Erase initial stamp
        this.eraseStamp(layer, x, y);
        this.app.renderer.requestRender();
    }

    onMouseMove(e, x, y) {
        if (!this.isErasing) return;

        const layer = this.app.layerStack.getActiveLayer();
        if (!layer || layer.locked) return;

        this.eraseLine(layer, this.lastX, this.lastY, x, y);

        this.lastX = x;
        this.lastY = y;
        this.app.renderer.requestRender();
    }

    onMouseUp(e, x, y) {
        this.isErasing = false;
    }

    onMouseLeave(e) {
        this.isErasing = false;
    }

    eraseStamp(layer, x, y) {
        const offset = this.size / 2;
        layer.ctx.globalCompositeOperation = 'destination-out';
        layer.ctx.globalAlpha = this.opacity / 100;
        layer.ctx.drawImage(this.eraserStamp, x - offset, y - offset);
        layer.ctx.globalCompositeOperation = 'source-over';
        layer.ctx.globalAlpha = 1.0;
    }

    eraseLine(layer, x1, y1, x2, y2) {
        const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const spacing = Math.max(1, this.size * 0.25);
        const steps = Math.max(1, Math.ceil(distance / spacing));

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = x1 + (x2 - x1) * t;
            const y = y1 + (y2 - y1) * t;
            this.eraseStamp(layer, x, y);
        }
    }

    onPropertyChanged(id, value) {
        if (id === 'size' || id === 'hardness') {
            this.updateEraserStamp();
        }
    }

    getProperties() {
        return [
            { id: 'size', name: 'Size', type: 'range', min: 1, max: 200, step: 1, value: this.size },
            { id: 'hardness', name: 'Hardness', type: 'range', min: 0, max: 100, step: 1, value: this.hardness },
            { id: 'opacity', name: 'Opacity', type: 'range', min: 1, max: 100, step: 1, value: this.opacity }
        ];
    }
}
