
    //#region properties
    isPlaying = false

    ticksPerSecond = 60
    stepsPerSecond = 50
    /** Time in seconds for entities to glow. */
    glowTime = 1
    //#endregion

    //#region constructor
    constructor(domElement) {
        super()

        this.domElement = domElement

        this.init()
    }

    init() {
        this.playButton.addEventListener('click', () => this.start())
        this.pauseButton.addEventListener('click', () => this.pause())
        this.on('isPlaying', isPlaying => this.domElement.classList.toggle('playing', isPlaying))

        setTimeout(() => this.tick(), 0)
    }

    setToTrace(trace, traceEntity) {
        this.cursor = trace.createCursor()
        this.traceEntity = traceEntity

        this.updateEntities()

        this.initFlamegraph()
    }

    initFlamegraph() {
        const container = this.domElement.querySelector('#flamegraph')
        container.innerHTML = ''

        this.flamegraph = d3Flamegraph.flamegraph()

        const width = 1000
        const cellHeight = 16
        const maxStackDepth = this.cursor.trace.maxStackDepth()
        /* const extraVerticalSpaceFraction = 1 / 4
        const maxExtraVerticalSpaceVh = 3
        const computedMaxExtraVerticalSpace = maxExtraVerticalSpaceVh / 100 * window.innerHeight
        const extraVerticalSpace = Math.min(height * extraVerticalSpaceFraction, computedMaxExtraVerticalSpace) */
        const extraVerticalSpace = 0
        //const cellHeight = (height - extraVerticalSpace) / maxStackDepth
        const height = cellHeight * maxStackDepth + extraVerticalSpace
        this.flamegraph
            .width(width)
            .height(height)
            .cellHeight(cellHeight)
        // TODO: make responsive
        // TODO: make scrollable (w/h)

        /* // react to size changes
        const resizeObserver = new ResizeObserver(() => {
            this.flamegraph.width(container.clientWidth)
            this.flamegraph.height(container.clientHeight)
        }).observe(container) */

        // Only display labels if effective height is large enough
        const minEffectiveCellHeightForLabel = 6
        let showLabels
        const updateShowLabels = () => {
            const newShowLabels = container.clientHeight / maxStackDepth > minEffectiveCellHeightForLabel
            if (newShowLabels == showLabels) return

            showLabels = newShowLabels
            console.log('showLabels', showLabels)
            this.flamegraph.getName(showLabels ? d => d.data.name : _d => undefined)
            this.flamegraph.update()
        }
        new ResizeObserver(() => {
            updateShowLabels()
        }).observe(container)

        this.flamegraph.tooltip(d3.tip()
           .direction("s")
           .offset([8, 0])
           .attr('class', 'd3-flame-graph-tip')
           .html(d => d.data.name))
        updateShowLabels()
        this.flamegraph
            .transitionDuration(0)
            .onClick(d => {
                if (d.parent) this.flamegraph.resetZoom()
            })
            .onHover(d => {
                this.hoveredFlamegraphObject = d?.data?.frame?.receiver
            })
            .setDetailsHandler(d => {
                if (d?.data?.frame == null) this.hoveredFlamegraphObject = undefined
            })

        const rootFrame = this.cursor.trace.rootFrame
        /* rootFrame.allFrames().forEach(frame => {
            frame.value = frame.endTime + 1 - frame.startTime
        }) */

        this.flamegraph.setColorMapper(d => {
            const frame = d.data.frame
            if (!frame) return 'transparent'

            const objectEntity = this.objectEntities.find(objectEntity => objectEntity.object == frame.receiver)
            const color = objectEntity?.baseMaterial?.color?.getHexString()
            if (color) return `#${objectEntity?.baseMaterial?.color?.getHexString()}`

            return '#aaa'
        })

        const toFlamegraphData = frame => {
            const data = {
                frame,
                get name() { return frame.toString() },
                value: frame.endTime + 1 - frame.startTime
            }
            data.children = []
            if (frame.children.length) {
                let time = frame.startTime
                frame.children.forEach((child, index) => {
                    // insert dummy to reserve space
                    data.children.push({
                        value: child.startTime - time,
                        children: []
                    })
                    // insert child
                    data.children.push(toFlamegraphData(child))
                    time = child.endTime + 1
                })
                // insert dummy to reserve space
                data.children.push({
                    value: frame.endTime + 1 - time,
                    children: []
                })
            }
            return data
        }
        const flamegraphData = toFlamegraphData(rootFrame)

        d3.select(container)
            .datum(flamegraphData)
            .call(this.flamegraph)

        const svg = container.querySelector('svg')
        svg.setAttribute('viewBox', `0 0 ${this.flamegraph.width()} ${this.flamegraph.height()}`)
        svg.setAttribute('preserveAspectRatio', 'none')
    }
    //#endregion

    //#region accessors
    get currentTime() {
        return this.cursor.currentTime
    }

    set currentTime(value) {
        this._tick(value - this.currentTime)
    }

    get playButton() {
        return this.domElement.querySelector('#player-play')
    }

    get pauseButton() {
        return this.domElement.querySelector('#player-pause')
    }
    //#endregion

    //#region control
    start() {
        if (!this.canStepForward()) {
            this.reset()
        }

        this.resume()
    }

    stop() {
        this.pause()
        this.reset()
    }

    restart() {
        this.stop()
        this.start()
    }

    resume() {
        this.isPlaying = true
        this.emit('isPlaying', true)
    }

    pause() {
        this.isPlaying = false
        this.emit('isPlaying', false)
    }

    reset() {
        this.resetSteps()
    }
    //#endregion

    //#region steps
    tick() {
        setTimeout(() => this.tick(), 1000 / this.ticksPerSecond)

        if (this.isPlaying) {
            this._tick()
        } else {
            this._tick(0)
        }
    }

    /**
     * @param {*} steps If undefined, steps are calculated from the time since the last tick.
     */
    _tick(steps = undefined) {
        if (!this.cursor) return

        const now = Date.now()
        const secondsSinceLastTick = (now - this.lastTick) / 1000

        let actualSteps
        if (steps === undefined) {  // calculate steps from time
            // Dithering (correct rounding errors)
            let exactSteps = secondsSinceLastTick * this.stepsPerSecond
            exactSteps += this.stepsRoundingError || 0
            actualSteps = Math.round(exactSteps)
            this.stepsRoundingError = exactSteps - steps
        } else {
            actualSteps = Math.round(steps)
            delete this.stepsRoundingError
        }

        this.doSteps(actualSteps, secondsSinceLastTick)
        this.lastTick = now

        if (steps === undefined && !this.canStepForward()) {
            this.pause()
        }
    }

    doSteps(steps, secondsSinceLastTick) {
        const activeObjects = new Set()
        if (steps) {
            this.cursor.step(steps, {
                visitFrame: frame => {
                    console.log(frame.toString())
                    activeObjects.add(frame.receiver)
                }
            })
        } else {
            const currentFrame = this.cursor.currentFrame
            if (currentFrame) activeObjects.add(currentFrame.receiver)
        }

        this.objectEntities.forEach(objectEntity => {
            objectEntity.setGlowState('active', activeObjects.has(objectEntity.object)
                ? 1
                : Math.max(0, objectEntity.getGlowFraction('active') - secondsSinceLastTick / this.glowTime))
        })

        const newHoveredFlamegraphObject = this.hoveredFlamegraphObject
        if (newHoveredFlamegraphObject != this.knownHoveredFlamegraphObject) {
            const knownObjectEntity = this.objectEntities.find(objectEntity => objectEntity.object == this.knownHoveredFlamegraphObject)
            knownObjectEntity?.removeHoveredEntity(this)
            const newObjectEntity = this.objectEntities.find(objectEntity => objectEntity.object == newHoveredFlamegraphObject)
            newObjectEntity?.addHoveredEntity(this)
            this.knownHoveredFlamegraphObject = newHoveredFlamegraphObject
        }
        this.flamegraph.update() // dynamic colors, including hover

        this.emit('step')
    }

    resetSteps() {
        this.cursor?.reset()
    }

    canStepForward() {
        return this.cursor.canStepForward()
    }
    //#endregion

    //#region updating
    updateEntities() {
        this.updateObjectEntities()
    }

    updateObjectEntities() {
        this.objectEntities = this.traceEntity.allObjectEntities()
    }
    //#endregion updating
}

export 