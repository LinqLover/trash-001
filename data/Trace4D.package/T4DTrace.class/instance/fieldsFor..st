building
fieldsFor: anObject

	| inspector inspectorFields |
	inspector := Inspector inspect: anObject.
	inspectorFields := Array streamContents: [:stream |
		[inspector streamVariableFieldsOn: stream]
			ifError: [inspector streamError: #error on: stream]].
	^ inspectorFields collect: [:inspectorField |
		inspectorField name asString -> inspectorField valueGetter]