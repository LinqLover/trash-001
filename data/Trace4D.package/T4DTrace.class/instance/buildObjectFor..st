building
buildObjectFor: anObject

	| fields |
	fields := self fieldsFor: anObject.
	^ self makeContainer
		class: (self nameForClass: (anObject perform: #class));
		name: (self stringFor: anObject);
		fields:
			(fields
				collect: [:field | field key -> (self idOrStringFor: (field value value: anObject))]
				as: self containerClass);
		historicFields:
			(fields
				collect: [:field | field key -> (self buildFieldHistoryFor: anObject field: field value)]
				as: self containerClass);
		yourself