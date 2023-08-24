

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

accessing
projectClass

	^ MetacelloCypressBaselineProject

{
	"class" : {
		 },
	"instance" : {
		"baseline:" : "ct 5/27/2023 01:26",
		"projectClass" : "ct 5/27/2023 01:23" } }


{
	"category" : "BaselineOfTrace4D",
	"classinstvars" : [
		 ],
	"classvars" : [
		 ],
	"commentStamp" : "",
	"instvars" : [
		 ],
	"name" : "BaselineOfTrace4D",
	"pools" : [
		 ],
	"super" : "BaselineOf",
	"type" : "normal" }
