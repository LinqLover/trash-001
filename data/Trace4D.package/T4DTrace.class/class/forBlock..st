instance creation
forBlock: aBlock

	^ self forCursor:
		(self cursorClass traceForBlock: aBlock)