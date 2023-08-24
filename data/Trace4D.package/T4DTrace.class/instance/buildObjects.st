building
buildObjects

	| objects |
	objects := self makeContainer.
	objectIds keysAndValuesDo: [:object :id |
		objects at: id put:
			(self buildObjectFor:
				(self cursor object: object atTime: self cursor maxTimeIndex))].
	^ objects