building
buildFieldHistoryFor: anObject field: field

	| slice |
	slice := self cursor object: anObject collect: [:object |
		| value error |
		[value := field value: object] ifError: [:err | error := err].
		error
			ifNotNil: ['<error: {1}>' format: {error}]
			ifNil: [self idOrStringFor: value]].
	slice intervals size > 1 ifFalse: [^ nil].
	^ self makeContainer
		times: (slice intervals allButLast collect: [:interval | interval stop + 1]);
		values: (slice values allButLast collect: [:value | value copy tdbproxyYourself]);
		yourself