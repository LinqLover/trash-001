baseline
baseline: spec
	<baseline>

	spec for: #common do: [
		"dependencies"
		spec
			baseline: 'TraceDebugger' with: [
				spec
					repository: 'github://hpi-swa-lab/squeak-tracedebugger';
					loads: 'TraceDebugger']].
		
		"packages"
		spec
			package: 'Trace4D' with: [
				spec requires: 'TraceDebugger'].
		
		"groups"
		spec
			group: #default with: #('Trace4D').