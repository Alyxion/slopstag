/**
 * CircleTool - Draw circles and ellipses.
 */
import { Tool } from './Tool.js';

export class CircleTool extends Tool {
    static id = 'circle';
    static name = 'Circle';
    static icon = 'circle';
    static shortcut = 'c';
    static cursor = 'crosshair';

    constructor(app) {
        super(app);
        this.fill = true;
        this.stroke = true;
        this.strokeWidth = 2;
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;

        this.previewCanvas = document.createElement('canvas');
        this.previewCtx = this.previewCanvas.getContext('2d');
    }

    onMouseDown(e, x, y) {
        const layer = this.app.layerStack.getActiveLayer();
        if (!layer || layer.locked) return;

        this.isDrawing = true;
        this.startX = x;
        this.startY = y;

        this.previewCanvas.width = layer.width;
        this.previewCanvas.height = layer.height;
        this.app.history.saveState('circle');
    }

    onMouseMove(e, x, y) {
        if (!this.isDrawing) return;

        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        this.drawEllipse(this.previewCtx, this.startX, this.startY, x, y, e.shiftKey);
        this.app.renderer.setPreviewLayer(this.previewCanvas);
    }

    onMouseUp(e, x, y) {
        if (!this.isDrawing) return;

        const layer = this.app.layerStack.getActiveLayer();
        if (layer && !layer.locked) {
            this.drawEllipse(layer.ctx, this.startX, this.startY, x, y, e.shiftKey);
        }

        this.isDrawing = false;
        this.app.renderer.clearPreviewLayer();
        this.app.renderer.requestRender();
    }

    onMouseLeave(e) {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.app.renderer.clearPreviewLayer();
        }
    }

    drawEllipse(ctx, x1, y1, x2, y2, constrain = false, options = {}) {
        let width = x2 - x1;
        let height = y2 - y1;

        // Constrain to circle if shift held
        if (constrain) {
            const size = Math.max(Math.abs(width), Math.abs(height));
            width = Math.sign(width) * size || size;
            height = Math.sign(height) * size || size;
        }

        const centerX = x1 + width / 2;
        const centerY = y1 + height / 2;
        const radiusX = Math.abs(width / 2);
        const radiusY = Math.abs(height / 2);

        if (radiusX <= 0 || radiusY <= 0) return;

        const fillColor = options.fillColor || this.app.foregroundColor || '#000000';
        const strokeColor = options.strokeColor || this.app.backgroundColor || '#FFFFFF';
        const doFill = options.fill !== undefined ? options.fill : this.fill;
        const doStroke = options.stroke !== undefined ? options.stroke : this.stroke;
        const strokeW = options.strokeWidth || this.strokeWidth;

        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);

        if (doFill) {
            ctx.fillStyle = fillColor;
            ctx.fill();
        }

        if (doStroke) {
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeW;
            ctx.stroke();
        }
    }

    drawCircle(ctx, centerX, centerY, radius, options = {}) {
        if (radius <= 0) return;

        const fillColor = options.fillColor || this.app.foregroundColor || '#000000';
        const strokeColor = options.strokeColor || this.app.backgroundColor || '#FFFFFF';
        const doFill = options.fill !== undefined ? options.fill : this.fill;
        const doStroke = options.stroke !== undefined ? options.stroke : this.stroke;
        const strokeW = options.strokeWidth || this.strokeWidth;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);

        if (doFill) {
            ctx.fillStyle = fillColor;
            ctx.fill();
        }

        if (doStroke) {
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeW;
            ctx.stroke();
        }
    }

    // API execution method
    executeAction(action, params) {
        const layer = this.app.layerStack.getActiveLayer();
        if (!layer || layer.locked) return { success: false, error: 'No active layer' };

        if (action === 'draw') {
            this.app.history.saveState('circle_api');

            const options = {
                fillColor: params.fillColor || params.color,
                strokeColor: params.strokeColor,
                fill: params.fill !== undefined ? params.fill : true,
                stroke: params.stroke !== undefined ? params.stroke : false,
                strokeWidth: params.strokeWidth,
            };

            // Support multiple input formats
            if (params.center && params.radius !== undefined) {
                // Circle by center + radius
                this.drawCircle(layer.ctx, params.center[0], params.center[1], params.radius, options);
            } else if (params.x !== undefined && params.y !== undefined && params.radius !== undefined) {
                // Circle by x, y, radius
                this.drawCircle(layer.ctx, params.x, params.y, params.radius, options);
            } else if (params.start && params.end) {
                // Ellipse by bounding box
                this.drawEllipse(layer.ctx, params.start[0], params.start[1], params.end[0], params.end[1], false, options);
            } else {
                return { success: false, error: 'Need center/radius or x/y/radius or start/end' };
            }

            this.app.renderer.requestRender();
            return { success: true };
        }
        return { success: false, error: 'Invalid action' };
    }

    getProperties() {
        return [
            { id: 'fill', name: 'Fill', type: 'checkbox', value: this.fill },
            { id: 'stroke', name: 'Stroke', type: 'checkbox', value: this.stroke },
            { id: 'strokeWidth', name: 'Stroke Width', type: 'range', min: 1, max: 50, step: 1, value: this.strokeWidth }
        ];
    }
}
