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
		saveFields = "idmembercoursereportcard searchTerm ap1label ap1value ap1progress ap2label ap2value ap2progress ap3label ap3value ap3progress ap4label ap4value ap4progress wh1label wh1value wh1progress wh2label wh2value wh2progress wh3label wh3value wh3progress wh4label wh4value wh4progress generalcomments suggestions learningfocus attendance lessoncount".split(" ");

	window.iL = iLearner;
	iLearner.Report = Report;

	/**
	 * Class for dealing with report cards
	 *
	 * @class Report
	 */

	/**
	 * Get a specific report by ID
	 *
	 * @method get
	 * @param id {int}
	 * @return {object}
	 */
	function getReport(id){
		return reports[id];
	}
	Report.get = getReport;

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
			post_data.searchDateFrom = iL.Util.formatDate(options.from);
		}

		if(options.to){
			post_data.searchDateTo = iL.Util.formatDate(options.to);
		}

		post_data.searchTerm = 3;

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
					var resultSet = [];
					if(data.MemberReportCardList){
						$.each(data.MemberReportCardList, function(i,item){
							var studentID = item.memberID,
								courseID = item.courseID,
								subscriptionID = item.membercourseid,
								reportID = item.membercourseid,
								student = iL.Student.get(studentID) || {
									id: studentID
								},
								course = iL.Course.get(courseID) || {
									id: courseID
								},
								subscription = iL.Subscription.get(course, student) || {
									id: subscriptionID,
									student: student,
									course: course
								},
								report = {
									id: reportID,
									student: student,
									course: course,
									subscription: subscription,
									complete: (item.completed == "1"),
									attendance: item.lessoncount - item.leavecount,
									lessoncount: item.lessoncount,
									searchTerm: 3
								};

							student.name = item.nickname;
							course.title = item.coursename;
							course.startTime = item.starttime;
							course.endTime = item.endtime;

							course.tutor = options.tutor;

							iL.parseName(student);

							iL.Student.add(student);
							iL.Course.add(course);
							iL.Subscription.add(subscription);

							// TODO: check if report already exists and don't replace it
							reports[item.id] = item;

							resultSet.push(report);
						});
					}
					return resultSet;
				});
		}

		return _reports[hash];
	}
	Report.find = find;

	/**
	 * Given a report stub this method provides the full report card details
	 *
	 * @method fetch
	 * @param item {object} Report
	 * @return {Promise} Returns a promise object which can be used to wait for results
	 */
	function fetchReport(item){
		var deferred = $.Deferred(),
			promise = deferred.promise();

		$.when(
			$.post(iL.API_ROOT + "process_getMemberReportCardDetail.php", { membercourseID: item.subscription.id, searchTerm: 3 },  null, "json"),
			getCourseLearningFocus(item.course)
		)
		.done(function(a1, focus){
			var detail = a1[0].MemberReportCardDetail[0],
				labels = "ap1label ap2label ap3label ap4label wh1label wh2label wh3label wh4label ap1progress ap2progress ap3progress ap4progress ap1value ap2value ap3value ap4value wh1value wh2value wh3value wh4value wh1progress wh2progress wh3progress wh4progress".split(" "),
				o = {
					ap1progress: "0",
					ap2progress: "0",
					ap3progress: "0",
					ap4progress: "0",
					wh1progress: "0",
					wh2progress: "0",
					wh3progress: "0",
					wh4progress: "0",
					ap1value: "A+",
					ap2value: "A+",
					ap3value: "A+",
					ap4value: "A+",
					wh1value: "A+",
					wh2value: "A+",
					wh3value: "A+",
					wh4value: "A+"
				},
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

		return Promise.resolve(promise);
	}
	Report.fetch = fetchReport;

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
									.replace("XXX",			"{ student.forename }")
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
	Report.Comments = getComments;
	/* deprecated - clearer that it is static method */
	Report.getComments = getComments;

	/**
	 * Get Learning focuses for courses
	 *
	 * @method getCourseLearningFocus
	 * @static
	 * @param courseName {string}
	 * @return {Promise} Promise of an array
	 */
	function getCourseLearningFocus(course){
		var deferred,
			post;
		if(!learningObjectives[course.id]){
			deferred = $.Deferred();
			post = $.post(iL.API_ROOT + "process_getCourseLearningFocus.php", { coursename: course.title + " " + course.level }, null, "json");
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
			learningObjectives[course.id] = deferred.promise();
		}
		return learningObjectives[course.id];
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
	function setCourseLearningFocus(course, focus, objective){
		getCourseLearningFocus(course)
			.done(function(focii){
				focii[focus] = objective;
			});
	}
	Report.setCourseLearningFocus = setCourseLearningFocus;

}(window));
