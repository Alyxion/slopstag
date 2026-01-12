/**
 * History - Undo/redo system with layer state serialization.
 */
import { Layer } from './Layer.js';

export class History {
    /**
     * @param {Object} app - Application reference
     * @param {number} [maxStates=50] - Maximum number of history states
     */
    constructor(app, maxStates = 50) {
        this.app = app;
        this.maxStates = maxStates;
        this.undoStack = [];
        this.redoStack = [];
    }

    /**
     * Save current state to history.
     * @param {string} [action='edit'] - Description of the action
     */
    saveState(action = 'edit') {
        // Serialize current layer stack state
        const state = {
            action: action,
            timestamp: Date.now(),
            layers: this.app.layerStack.layers.map(layer => layer.serialize()),
            activeIndex: this.app.layerStack.activeLayerIndex
        };

        this.undoStack.push(state);

        // Clear redo stack on new action
        this.redoStack = [];

        // Limit stack size
        if (this.undoStack.length > this.maxStates) {
            this.undoStack.shift();
        }

        this.app.eventBus.emit('history:changed', this.getStatus());
    }

    /**
     * Undo the last action.
     * @returns {boolean}
     */
    async undo() {
        if (this.undoStack.length === 0) return false;

        // Save current state to redo stack
        const currentState = {
            action: 'undo',
            timestamp: Date.now(),
            layers: this.app.layerStack.layers.map(layer => layer.serialize()),
            activeIndex: this.app.layerStack.activeLayerIndex
        };
        this.redoStack.push(currentState);

        // Restore previous state
        const prevState = this.undoStack.pop();
        await this.restoreState(prevState);

        this.app.eventBus.emit('history:changed', this.getStatus());
        return true;
    }

    /**
     * Redo the last undone action.
     * @returns {boolean}
     */
    async redo() {
        if (this.redoStack.length === 0) return false;

        // Save current state to undo stack
        const currentState = {
            action: 'redo',
            timestamp: Date.now(),
            layers: this.app.layerStack.layers.map(layer => layer.serialize()),
            activeIndex: this.app.layerStack.activeLayerIndex
        };
        this.undoStack.push(currentState);

        // Restore next state
        const nextState = this.redoStack.pop();
        await this.restoreState(nextState);

        this.app.eventBus.emit('history:changed', this.getStatus());
        return true;
    }

    /**
     * Restore a saved state.
     * @param {Object} state
     */
    async restoreState(state) {
        // Clear current layers
        this.app.layerStack.layers = [];

        // Recreate layers from serialized state
        for (const layerData of state.layers) {
            const layer = await Layer.deserialize(layerData);
            this.app.layerStack.layers.push(layer);
        }

        this.app.layerStack.activeLayerIndex = state.activeIndex;
        this.app.renderer.requestRender();
        this.app.eventBus.emit('layers:restored');
    }

    /**
     * Get current history status.
     * @returns {{canUndo: boolean, canRedo: boolean, undoCount: number, redoCount: number}}
     */
    getStatus() {
        return {
            canUndo: this.undoStack.length > 0,
            canRedo: this.redoStack.length > 0,
            undoCount: this.undoStack.length,
            redoCount: this.redoStack.length
        };
    }

    /**
     * Clear all history.
     */
    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.app.eventBus.emit('history:changed', this.getStatus());
    }
}
