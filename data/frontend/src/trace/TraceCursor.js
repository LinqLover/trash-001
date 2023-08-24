
  //#region properties
  trace
  currentTime
  /** Last item is top frame */
  currentStack

  get currentFrame() {
    return this.currentStack[this.currentStack.length - 1]
  }

  get startTime() {
    return this.trace.rootFrame.startTime
  }

  get endTime() {
    return this.trace.rootFrame.endTime
  }
  //#endregion

  //#region constructor
  constructor(trace) {
    this.trace = trace
    this.reset()
  }
  //#endregion

  //#region steps
  reset() {
    this.currentTime = this.startTime - 1
    this.currentStack = []
  }

  step(steps, options = {}) {
    if (steps === undefined) {
      return this.stepTo(this.endTime, options)
      // TODO: why does Infinity not work here and step to far?
      // TODO: would it be cleaner if stack could never be empty?
    }
    console.assert(steps === Math.floor(steps))

    if (steps > 0) {
      steps = Math.min(steps, this.endTime + 1 - this.currentTime)
      this.stepForward(steps, options)
    } else if (steps < 0) {
      steps = Math.max(steps, this.startTime - 1 - this.currentTime)
      this.stepBackward(-steps, options)
    }
  }

  stepTo(time, options = {}) {
    this.step(time - this.currentTime, options)
  }

  stepForward(steps, options = {}) {
    // steps must be an integer
    const { visitFrame } = options

    if (this.currentTime === this.startTime - 1) {
      this.currentTime++
      this._stepInto(this.trace.rootFrame)
    }

    let stepsLeft = steps
    while (stepsLeft > 0) {
      if (this.currentStack.length === 0) {
        throw new Error(`Ran out of frames after ${steps - stepsLeft} steps`)
      }

      const currentFrame = this.currentStack[this.currentStack.length - 1]
      const nextChild = currentFrame.children.find(child => child.startTime > this.currentTime)
      const nextFrameTime = nextChild ? nextChild.startTime : currentFrame.endTime + 1
      const timeUntilNextFrame = nextFrameTime - this.currentTime
      if (timeUntilNextFrame > 0) {
        visitFrame?.(currentFrame, this)
      }

      if (timeUntilNextFrame > stepsLeft) {
        this.currentTime += stepsLeft
        stepsLeft = 0
      } else {
        this.currentTime += timeUntilNextFrame
        stepsLeft -= timeUntilNextFrame
        if (nextChild != null) {
          this._stepInto(nextChild)
        } else {
          this._stepOut()
        }
      }
    }
  }

  stepBackward(steps, options = {}) {
    const { visitFrame } = options

    if (this.currentTime === this.endTime + 1) {
      this.currentTime--
      this._stepInto(this.trace.rootFrame)
    }

    let stepsLeft = steps
    while (stepsLeft > 0) {
      if (this.currentStack.length === 0) {
        throw new Error(`Ran out of frames after ${steps - stepsLeft} steps`)
      }

      const currentFrame = this.currentStack[this.currentStack.length - 1]
      const previousChild = currentFrame.children.slice().reverse().find(child => child.endTime < this.currentTime)
      const previousFrameTime = previousChild ? previousChild.endTime : currentFrame.startTime - 1
      const timeUntilPreviousFrame = this.currentTime - previousFrameTime
      if (timeUntilPreviousFrame > 0) {
        visitFrame?.(currentFrame, this)
      }

      if (timeUntilPreviousFrame > stepsLeft) {
        this.currentTime -= stepsLeft
        stepsLeft = 0
      } else {
        this.currentTime -= timeUntilPreviousFrame
        stepsLeft -= timeUntilPreviousFrame
        if (previousChild != null) {
          this._stepInto(previousChild)
        } else {
          this._stepOut()
        }
      }
    }
  }

  canStepForward(steps = 1) {
    return this.currentTime + steps <= this.endTime
  }

  canStepBackward(steps = 1) {
    return this.currentTime - steps >= this.startTime
  }

  _stepInto(frame) {
    this.currentStack.push(frame)
  }

  _stepOut() {
    this.currentStack.pop()
  }
  //#endregion
}
