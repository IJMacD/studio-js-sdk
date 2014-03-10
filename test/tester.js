(function(window){
	var Tester = window.Tester || {},
		$ = window.jQuery,

		resultsDiv,
		resultsList,
		resultsCounter,

		totalTestsStarted = 0,
		totalTestsCompleted = 0,
		totalTestsPassed = 0;

	$(function(){
		$('head').append('<link rel="stylesheet" href="tester.css" />');
		resultsDiv = $('#results');

		if(!resultsDiv.length){
			resultsDiv = $('<div id="results"></div>').appendTo('body');
		}

		resultsDiv.empty();

		resultsCounter = $('<h1>').appendTo(resultsDiv);

		resultsList = $('<dl>').appendTo(resultsDiv);
	});

	function testAsync(tests){
		for (name in tests){
			if(tests.hasOwnProperty(name)){
				(function(name){
					var returnValue,
						passed = false,
						success = function(){
							passed = true;
							logResult(name, passed);
						},
						failure = function(){
							passed = false;
							logResult(name, passed);
						};
					totalTestsStarted++;
					returnValue = tests[name](this, success, failure);
				}(name));
			}
		}
		$(function(){logResult()});
	}
	Tester.testAsync = testAsync;

	function logResult(name, passed){
		if(name){
			totalTestsCompleted += 1;
			totalTestsPassed += passed ? 1 : 0;

			resultsList.append("<dt>" + name + '</dt><dd class="' + (passed?'passed':'failed') + '">' + (passed?'Test Passed':'Test Failed'));
		}
		resultsCounter.text("Started: " + totalTestsStarted
			+ " Completed: "  + totalTestsCompleted
			+ " Passed: " + totalTestsPassed);
	}

	window.Tester = Tester;
}(window));
