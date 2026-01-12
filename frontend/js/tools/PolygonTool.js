/**
 * PolygonTool - Draw multi-point polygons.
 * Click to add points, double-click or press Enter to close.
 */
import { Tool } from './Tool.js';

export class PolygonTool extends Tool {
    static id = 'polygon';
    static name = 'Polygon';
    static icon = 'polygon';
    static shortcut = 'p';
    static cursor = 'crosshair';

    constructor(app) {
        super(app);

        // Polygon properties
        this.fill = true;
        this.stroke = true;
        this.strokeWidth = 2;

        // State
        this.points = [];
        this.isDrawing = false;

        // Preview canvas
        this.previewCanvas = document.createElement('canvas');
        this.previewCtx = this.previewCanvas.getContext('2d');
    }

    onMouseDown(e, x, y) {
        const layer = this.app.layerStack.getActiveLayer();
        if (!layer || layer.locked) return;

        // Set up preview canvas on first point
        if (!this.isDrawing) {
            this.previewCanvas.width = layer.width;
            this.previewCanvas.height = layer.height;
            this.points = [];
            this.isDrawing = true;
        }

        // Add point
        this.points.push([x, y]);

        // Update preview
        this.drawPreview(x, y);
    }

    onMouseMove(e, x, y) {
        if (!this.isDrawing || this.points.length === 0) return;

        // Update preview with current mouse position
        this.drawPreview(x, y);
    }

    onMouseUp(e, x, y) {
        // Points are added on mousedown
    }

    onKeyDown(e) {
        if (e.key === 'Enter' && this.isDrawing && this.points.length >= 3) {
            this.commitPolygon();
        } else if (e.key === 'Escape') {
            this.cancelPolygon();
        } else if (e.key === 'Backspace' && this.points.length > 0) {
            // Remove last point
            this.points.pop();
            if (this.points.length === 0) {
                this.cancelPolygon();
            } else {
                this.drawPreview(this.points[this.points.length - 1][0], this.points[this.points.length - 1][1]);
            }
        }
    }

    drawPreview(mouseX, mouseY) {
        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);

        if (this.points.length === 0) return;

        const fgColor = this.app.foregroundColor || '#000000';
        const bgColor = this.app.backgroundColor || '#FFFFFF';

        this.previewCtx.beginPath();
        this.previewCtx.moveTo(this.points[0][0], this.points[0][1]);

        for (let i = 1; i < this.points.length; i++) {
            this.previewCtx.lineTo(this.points[i][0], this.points[i][1]);
        }

        // Line to current mouse position
        this.previewCtx.lineTo(mouseX, mouseY);

        // Preview closing line (dashed)
        this.previewCtx.setLineDash([5, 5]);
        this.previewCtx.lineTo(this.points[0][0], this.points[0][1]);

        if (this.fill) {
            this.previewCtx.fillStyle = fgColor;
            this.previewCtx.globalAlpha = 0.3;
            this.previewCtx.fill();
            this.previewCtx.globalAlpha = 1.0;
        }

        if (this.stroke) {
            this.previewCtx.strokeStyle = bgColor;
            this.previewCtx.lineWidth = this.strokeWidth;
            this.previewCtx.stroke();
        }

        this.previewCtx.setLineDash([]);

        // Draw points
        for (const point of this.points) {
            this.previewCtx.fillStyle = '#0078d4';
            this.previewCtx.beginPath();
            this.previewCtx.arc(point[0], point[1], 4, 0, Math.PI * 2);
            this.previewCtx.fill();
        }

        this.app.renderer.setPreviewLayer(this.previewCanvas);
    }

    commitPolygon() {
        if (this.points.length < 3) {
            this.cancelPolygon();
            return;
        }

        const layer = this.app.layerStack.getActiveLayer();
        if (!layer || layer.locked) {
            this.cancelPolygon();
            return;
        }

        this.app.history.saveState('polygon');

        const ctx = layer.ctx;
        const fgColor = this.app.foregroundColor || '#000000';
        const bgColor = this.app.backgroundColor || '#FFFFFF';

        ctx.beginPath();
        ctx.moveTo(this.points[0][0], this.points[0][1]);
        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i][0], this.points[i][1]);
        }
        ctx.closePath();

        if (this.fill) {
            ctx.fillStyle = fgColor;
            ctx.fill();
        }

        if (this.stroke) {
            ctx.strokeStyle = bgColor;
            ctx.lineWidth = this.strokeWidth;
            ctx.stroke();
        }

        this.cleanup();
        this.app.renderer.requestRender();
    }

    cancelPolygon() {
        this.cleanup();
    }

    cleanup() {
        this.points = [];
        this.isDrawing = false;
        this.app.renderer.clearPreviewLayer();
    }

    deactivate() {
        super.deactivate();
        if (this.isDrawing) {
            this.cancelPolygon();
        }
    }

    getProperties() {
        return [
            { id: 'fill', name: 'Fill', type: 'select', options: ['true', 'false'], value: String(this.fill) },
            { id: 'stroke', name: 'Stroke', type: 'select', options: ['true', 'false'], value: String(this.stroke) },
            { id: 'strokeWidth', name: 'Stroke Width', type: 'range', min: 1, max: 50, step: 1, value: this.strokeWidth }
        ];
    }

    onPropertyChanged(id, value) {
        if (id === 'fill' || id === 'stroke') {
            this[id] = value === 'true';
        }
    }

    // API execution
    executeAction(action, params) {
        const layer = this.app.layerStack.getActiveLayer();
        if (!layer || layer.locked) {
            return { success: false, error: 'No active layer or layer is locked' };
        }

        if (action === 'draw' && params.points && params.points.length >= 3) {
            if (params.fill !== undefined) this.fill = params.fill;
            if (params.stroke !== undefined) this.stroke = params.stroke;
            if (params.strokeWidth !== undefined) this.strokeWidth = params.strokeWidth;
            if (params.fillColor) this.app.foregroundColor = params.fillColor;
            if (params.strokeColor) this.app.backgroundColor = params.strokeColor;
            if (params.color) this.app.foregroundColor = params.color;

            this.app.history.saveState('polygon_api');

            const ctx = layer.ctx;
            const fgColor = this.app.foregroundColor || '#000000';
            const bgColor = this.app.backgroundColor || '#FFFFFF';

            ctx.beginPath();
            ctx.moveTo(params.points[0][0], params.points[0][1]);
            for (let i = 1; i < params.points.length; i++) {
                ctx.lineTo(params.points[i][0], params.points[i][1]);
            }
            ctx.closePath();

            if (this.fill) {
                ctx.fillStyle = fgColor;
                ctx.fill();
            }

            if (this.stroke) {
                ctx.strokeStyle = bgColor;
                ctx.lineWidth = this.strokeWidth;
                ctx.stroke();
            }

            this.app.renderer.requestRender();
            return { success: true };
        }

        return { success: false, error: `Unknown action: ${action}. Use 'draw' with points array.` };
    }
}
