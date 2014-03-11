(function(window){

	/**
	 * Report module. Contains Report class.
	 *
	 * @module Report
	 */
	var iLearner = window.iLearner || {},
		Report = {},

		_reports = {},
		reports = {},
		learningObjectives = {},

		comments,

		learningDefaults = {wh1label: "Politeness", wh2label: "Attentiveness", wh3label: "Participation", wh4label: "Effort"},
		saveFields = "idmembercoursereportcard ap1label ap1value ap1progress ap2label ap2value ap2progress ap3label ap3value ap3progress ap4label ap4value ap4progress wh1label wh1value wh1progress wh2label wh2value wh2progress wh3label wh3value wh3progress wh4label wh4value wh4progress generalcomments suggestions learningfocus lessoncount".split(" ");

	window.iL = iLearner;
	iLearner.Report = Report;

	/**
	 * Class for dealing with report cards
	 *
	 * @class Report
	 */

	/**
	 * Get an array of report card stubs
	 *
	 * @method find
	 * @param options {object} Object describing search parameters
	 * @param [options.tutor] {object} Only get reports for this tutor
	 * @param [options.from] {Date} Reports for lessons which occur after this date
	 * @param [options.to] {Date} Reports for lessons which occur before this date
	 * @param [options.clearCache] {boolean} Do not fetch from the cache, instead hit server
	 * @return {Promise} Returns a promise object which can be used to wait for results
	 */
	function find(options){
		var post_data = {},
			hash;

		options = options || {};

		if(options.tutor){
			post_data.searchTutor = options.tutor.id || options.tutor;
		}

		if(options.from){
			post_data.searchDateFrom = formatDate(options.from);
		}

		if(options.to){
			post_data.searchDateTo = formatDate(options.to);
		}

		hash = JSON.stringify(post_data);

		if(options.clearCache){
			_reports[hash] = undefined;
		}

		if(!_reports[hash]){
			_reports[hash] = Promise.resolve(
				$.post(iL.API_ROOT + "process_getMemberReportCardList.php",
					post_data,
					null,
					"json")
				)
				.then(function(data){
					var resultSet;
					if(data.MemberReportCardList){
						resultSet = data.MemberReportCardList;
						$.each(resultSet, function(i,item){
							item.id = item.membercourseid;
							item.studentId = item.memberID;
							item.name = item.nickname;
							item.course = {
								id: item.courseID,
								title: item.coursename,
								startTime: item.starttime,
								endTime: item.endtime
							};
							item.memberCourseId = item.membercourseid;
							item.complete = (item.completed == "1");
							item.tutor = options.tutor;

							iL.parseName(item);

							// TODO: check if report already exists and don't replace it
							reports[item.id] = item;
						});
						return resultSet;
					}
				});
		}

		return _reports[hash];
	}
	Report.find = find;
	/* @deprecated */
	Report.search = find;

	/**
	 * Given a report stub this method provides the full report card details
	 *
	 * @method get
	 * @param item {object} Report
	 * @return {Promise} Returns a promise object which can be used to wait for results
	 */
	function get(item){
		var deferred = $.Deferred(),
			promise = deferred.promise();

		$.when(
			$.post(iL.API_ROOT + "process_getMemberReportCardDetail.php", { membercourseID: item.id },  null, "json"),
			getCourseLearningFocus(item.courseName)
		)
		.done(function(a1, focus){
			var detail = a1[0].MemberReportCardDetail[0],
				labels = "ap1label ap2label ap3label ap4label wh1label wh2label wh3label wh4label".split(" "),
				o = {},
				i;

			// wh labels from code are lowest priority
			$.extend(o, learningDefaults);

			// ap labels from second query are next priority
			$.extend(o, focus);

			// labels already set in detail object are highest priority
			// but by default they are set as null which would overwrite our defaults
			for(i in labels) {
				if(!detail[labels[i]]){
					detail[labels[i]] = undefined;
				}
			}

			$.extend(o, detail);

			o.tutor = undefined;

			// There should be no conflict with labels when merging into report stub
			$.extend(item, o);

			deferred.resolve(item);
		})
		.fail(deferred.reject);

		return promise;
	}
	Report.get = get;

	/**
	 * When provided with a full report object this method will save the report
	 * back to the server.
	 *
	 * @method save
	 * @param item {object} Report
	 * @return {Promise} can be used to wait for results
	 */
	function save(item){
		var post_data = {},
			i, k;
		item.complete = true;
		for(i in saveFields){
			k = saveFields[i];
			post_data[k] = item[k];
		}
		return $.post(iL.API_ROOT + "process_updateMemberReportCardDetail.php", post_data, null, "json");
	}
	Report.save = save;

	/**
	 * Static method to get comment templates
	 *
	 * @method getComments
	 * @static
	 * @return {Promise} Promise of an array
	 */
	function getComments(){

		if(!comments){
			comments = $.Deferred();

			$.get(iL.API_ROOT + "comment.php")
				.done(function(data){
					var result = {
						good: [],
						average: [],
						suggestions: [],
						focus: []
					};
					result.good.regex = /good_comments\.push\("([^"]+)"\)/g;
					result.average.regex = /average_comments\.push\("([^"]+)"\)/g;
					result.suggestions.regex = /suggestions\.push\("([^"]+)"\)/g;
					result.focus.regex = /focus\.push\("([^"]+)"\)/g;

					$.each(result, function(i,item){
						$.each(data.match(item.regex), function(i,comment){
							item.regex.lastIndex = 0;
							item.push(
								item.regex.exec(comment)[1]
									.replace("XXX",			"{ forename }")
									.replace(/\bshe\b/g,	"{ pronounSubject }")
									.replace(/\bShe\b/g,	"{ pronounSubjectCapitalize }")
									.replace(/\bherself\b/g,"{ pronounReflexive }")
									.replace(/\bher\b/g,	"{ pronounPossesive }")
									.replace(/\bHer\b/g,	"{ pronounPossesiveCapitalize }")
									.replace(/\bgirl\b/g,	"{ nounGender }")
									.replace(/\bhe\b/g,		"{ pronounSubject }")
									.replace(/\bHe\b/g,		"{ pronounSubjectCapitalize }")
									.replace(/\bhimself\b/g,"{ pronounReflexive }")
									.replace(/\bhis\b/g,	"{ pronounPossesive }")
									.replace(/\bHis\b/g,	"{ pronounPossesiveCapitalize }")
									.replace(/\bhim\b/g,	"{ pronounObject }")
									.replace(/\bboy\b/g,	"{ nounGender }")
							);
						});
						item.regex = undefined;
					});

					comments.resolve(result);
				});
		}
		return comments.promise();
	}
	Report.getComments = getComments;

	/**
	 * Get Learning focuses for courses
	 *
	 * @method getCourseLearningFocus
	 * @static
	 * @param courseName {string}
	 * @return {Promise} Promise of an array
	 */
	function getCourseLearningFocus(courseName){
		var deferred,
			post;
		if(!learningObjectives[courseName]){
			deferred = $.Deferred();
			post = $.post(iL.API_ROOT + "process_getCourseLearningFocus.php", { coursename: courseName }, null, "json");
			post.done(function(data){
				var focus = data.CourseFocusObject[0],
					o = {};
				if(focus){
					o.ap1label = focus.ap1;
					o.ap2label = focus.ap2;
					o.ap3label = focus.ap3;
					o.ap4label = focus.ap4;
				}
				deferred.resolve(o);
			});
			learningObjectives[courseName] = deferred.promise();
		}
		return learningObjectives[courseName];
	}

	/**
	 * Set course learning objective for a course
	 *
	 * DOES NOT save back to server, only for current session
	 *
	 * @method setCourseLearningFocus
	 * @static
	 * @param courseName {string}
	 * @param focus {string} Which of the four fields to set
	 * @param objective {string} Actual text of the objective
	 */
	function setCourseLearningFocus(courseName, focus, objective){
		getCourseLearningFocus(courseName)
			.done(function(focii){
				focii[focus] = objective;
			});
	}
	Report.setCourseLearningFocus = setCourseLearningFocus;

}(window));
