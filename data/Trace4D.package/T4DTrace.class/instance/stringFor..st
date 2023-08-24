building
stringFor: anObject

	^ [anObject printString] ifError: [:error | '<printString error: {1}>' format: {error}]