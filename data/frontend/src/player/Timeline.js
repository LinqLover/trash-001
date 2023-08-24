
    //#region constructor
    constructor(domElement) {
        super()

        this.domElement = domElement
        this.init()
    }

    init() {
        this.cursor = this.domElement.querySelector('#cursor')

        this.domElement.addEventListener('pointerdown', this._boundEventHandler('onPointerDown'))

        // Optimization (this saves us 4ms/call)
        // TODO: Update via ResizeObserver
        this.domElementClientWidth = this.domElement.clientWidth
        this.cursorClientWidth = this.cursor.clientWidth
    }
    //#endregion

    //#region accessors
    minTime
    maxTime

    get time() {
        return this.minTime + this._cursorX
            /// (this.domElement.clientWidth - this.cursor.clientWidth)
            / (this.domElementClientWidth - this.cursorClientWidth)
            * (this.maxTime - this.minTime)
    }

    set time(value) {
        this._cursorX = (value - this.minTime)
            / (this.maxTime - this.minTime)
            //* (this.domElement.clientWidth - this.cursor.clientWidth)
            * (this.domElementClientWidth - this.cursorClientWidth)
    }

    get _cursorX() {
        return new DOMMatrixReadOnly(getComputedStyle(this.cursor).transform).m41
    }

    set _cursorX(value) {
        // transform is required for sub-pixel-precise rendering
        this.cursor.style.transform = `translateX(${value}px)`
    }
    //#endregion

    //#region events
    onPointerDown(event) {
        this.dragging = true
        this.setCursorFromPointer(event)

        // Add global event listeners to track pointer dragging outside the timeline
        const document = this.domElement.ownerDocument
        document.addEventListener('pointermove', this._boundEventHandler('onPointerMove'), true)
        document.addEventListener('pointerup', this._boundEventHandler('onPointerUp'), true)

        this.emit('startDrag')
    }

    onPointerMove(event) {
        if (event.isT4dSimulated) return
        if (!this.dragging) return
        console.log('move', event)

        this.setCursorFromPointer(event)
    }

    onPointerUp(event) {
        if (event.isT4dSimulated) return

        this.setCursorFromPointer(event)
        this.dragging = false

        const document = this.domElement.ownerDocument
        document.removeEventListener('pointermove', this._boundEventHandler('onPointerMove'), true)
        document.removeEventListener('pointerup', this._boundEventHandler('onPointerUp'), true)

        this.emit('endDrag')
    }

    setCursorFromPointer(event) {
        let x = event.pageX - this.domElement.getBoundingClientRect().left
        x = Math.max(
            this.cursor.clientWidth / 2,
            Math.min(this.domElement.clientWidth - this.cursor.clientWidth / 2,
            x)
        )
        x -= this.cursor.clientWidth / 2
        this._cursorX = x

        this.emit('time')
    }

    _boundEventHandler(functionName) {
        // Preserve bound function instances for removing them later
        return (this._boundEventHandlers ??= {})[functionName] ??= this[functionName].bind(this)
    }
    //#endregion
}
