building
idOrStringFor: anObject

	^ objectIds at: anObject ifAbsent:
		[(self stringFor: anObject) ifNotEmpty: [:string |
			('@\' includes: string first)
				ifTrue: [string copyWithFirst: $\]
				ifFalse: [string]]]