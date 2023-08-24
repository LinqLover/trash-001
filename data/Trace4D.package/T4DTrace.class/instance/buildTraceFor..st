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