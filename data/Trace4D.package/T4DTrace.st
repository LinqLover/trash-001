

accessing
cursorClass

	^ TDBCursor

instance creation
forBlock: aBlock

	^ self forCursor:
		(self cursorClass traceForBlock: aBlock)

instance creation
forCursor: aTDBCursor

	^ self new cursor: aTDBCursor

building
buildClasses

	| classes |
	classes := self makeContainer.
	classNames keysAndValuesDo: [:class :name |
		classes at: name put:
			(self makeContainer
				category: class category;
				package: (class packageInfo ifNotNil: [:package | package name]);
				yourself)].
	^ classes

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

building
buildJson

	| trace objects classes |
	objectIds := PluggableDictionary
		hashBlock: [:a | a perform: #identityHash]
		equalBlock: [:a :b | a tdbIdentical: b].
	classNames := Dictionary new.
	
	trace := self buildTrace.
	objects := self buildObjects.
	classes := self buildClasses.
	
	^ self makeContainer
		objects: objects;
		classes: classes;
		trace: trace;
		yourself

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

building
buildObjects

	| objects |
	objects := self makeContainer.
	objectIds keysAndValuesDo: [:object :id |
		objects at: id put:
			(self buildObjectFor:
				(self cursor object: object atTime: self cursor maxTimeIndex))].
	^ objects

building
buildTrace

	^ self buildTraceFor:
		(self cursor contextAtTime: 0)

building
buildTraceFor: aContext

	| trace |
	trace := self makeContainer
		receiver: (self objectIdFor: aContext receiver);
		message: aContext tdbBlockAndSelectorString;
		arguments:
			((aContext arguments collect: [:ea | self idOrStringFor: ea])
				copy collect: [:ea | ea tdbproxyYourself]) tdbproxyYourself;
		yourself.
	self cursor returnValueFor: aContext ifPresent: [:value |
		trace answer: (self idOrStringFor: value)].
	trace
		startTime: (self cursor minTimeIndexFor: aContext);
		endTime: (self cursor maxTimeIndexFor: aContext);
		children: ((self cursor childContextsFor: aContext)
			collect: [:childContext | self buildTraceFor: childContext]).
	^ trace

private
containerClass

	^ OrderedJsonObject

accessing
cursor: aTDBCursor

	cursor := aTDBCursor.

accessing
cursor

	^ cursor

building
fieldsFor: anObject

	| inspector inspectorFields |
	inspector := Inspector inspect: anObject.
	inspectorFields := Array streamContents: [:stream |
		[inspector streamVariableFieldsOn: stream]
			ifError: [inspector streamError: #error on: stream]].
	^ inspectorFields collect: [:inspectorField |
		inspectorField name asString -> inspectorField valueGetter]

building
idOrStringFor: anObject

	^ objectIds at: anObject ifAbsent:
		[(self stringFor: anObject) ifNotEmpty: [:string |
			('@\' includes: string first)
				ifTrue: [string copyWithFirst: $\]
				ifFalse: [string]]]

private
makeContainer

	^ self containerClass new

building
nameForClass: aClass

	^ classNames at: aClass ifAbsentPut:
		[aClass name]

building
objectIdFor: anObject

	^ objectIds at: anObject ifAbsentPut:
		['@' , UUID new]

writing
storeJsonInFileNamed: fileName

	| json |
	json := self buildJson.
	FileStream newFileNamed: fileName do: [:stream |
		json jsonWriteOn: stream].

building
stringFor: anObject

	^ [anObject printString] ifError: [:error | '<printString error: {1}>' format: {error}]

{
	"class" : {
		"cursorClass" : "ct 5/26/2023 00:40",
		"forBlock:" : "ct 5/21/2023 17:39",
		"forCursor:" : "ct 5/21/2023 17:39" },
	"instance" : {
		"buildClasses" : "ct 5/21/2023 18:36",
		"buildFieldHistoryFor:field:" : "ct 5/26/2023 00:45",
		"buildJson" : "ct 5/21/2023 18:37",
		"buildObjectFor:" : "ct 5/27/2023 01:20",
		"buildObjects" : "ct 5/21/2023 18:48",
		"buildTrace" : "ct 5/21/2023 18:30",
		"buildTraceFor:" : "ct 5/21/2023 20:01",
		"containerClass" : "ct 5/21/2023 18:36",
		"cursor" : "ct 5/21/2023 17:39",
		"cursor:" : "ct 5/21/2023 17:39",
		"fieldsFor:" : "ct 5/21/2023 18:40",
		"idOrStringFor:" : "ct 5/21/2023 18:54",
		"makeContainer" : "ct 5/21/2023 18:36",
		"nameForClass:" : "ct 5/21/2023 19:57",
		"objectIdFor:" : "ct 5/21/2023 17:53",
		"storeJsonInFileNamed:" : "ct 5/21/2023 20:05",
		"stringFor:" : "ct 5/21/2023 18:34" } }


{
	"category" : "Trace4D",
	"classinstvars" : [
		 ],
	"classvars" : [
		 ],
	"commentStamp" : "",
	"instvars" : [
		"cursor",
		"objectIds",
		"classNames" ],
	"name" : "T4DTrace",
	"pools" : [
		 ],
	"super" : "Object",
	"type" : "normal" }
