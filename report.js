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
		saveFields = "idmembercoursereportcard ap1label ap1value ap1progress ap2label ap2value ap2progress ap3label ap3value ap3progress ap4label ap4value ap4progress wh1label wh1value wh1progress wh2label wh2value wh2progress wh3label wh3value wh3progress wh4label wh4value wh4progress generalcomments suggestions learningfocus attendance lessoncount".split(" ");

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

		if(options.term){
			post_data.searchTerm = options.term.id;
		}

		hash = JSON.stringify(post_data);

		if(options.clearCache){
			_reports[hash] = undefined;
		}

		if(!_reports[hash]){
			_reports[hash] = iL.query("process_getMemberReportCardList.php", post_data)
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
									term: options.term
								};

							student.name = item.nickname;
							course.title = item.coursename;
							course.startTime = item.starttime;
							course.endTime = item.endtime;

							course.tutor = options.tutor;

							iL.Util.parseName(student);

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
		var term = item.term || {};

		return Promise.all([
			iL.query("process_getMemberReportCardDetail.php", { membercourseID: item.subscription.id, searchTerm: term.id }),
			getCourseLearningFocus(item.course)
		])
		.then(function(results){
			var a1 = results[0],
				focus = results[1],
				detail = a1.MemberReportCardDetail[0],
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

			return item;
		});
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
		post_data.searchTerm = item.term && item.term.id;
		for(i in saveFields){
			k = saveFields[i];
			post_data[k] = item[k];
		}
		return iL.query("process_updateMemberReportCardDetail.php", post_data);
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
							comments: {},
							improvement: {},
							focus: []
						},

						commentRegex = /^var ([a-z]+)_comments/igm,
						improvementRegex = /^var ([a-z]+)_improvement/igm,

						focusRegex = /focus\.push\("([^"]+)"\)/g,

						name,
						regex,
						matches;

					function parseComments(list, regex){
						var match;
						while(match = regex.exec(data)){
							list.push(
								match[1]
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
						}
					}

					while(match = commentRegex.exec(data)){
						name = match[1];
						result.comments[name] = [];

						regex = new RegExp(name + '_comments\\.push\\("([^"]+)"\\)', 'gi');

						parseComments(result.comments[name], regex);
					}

					while(match = improvementRegex.exec(data)){
						name = match[1];
						result.improvement[name] = [];

						regex = new RegExp(name + '_improvement\\.push\\("([^"]+)"\\)', 'gi');

						parseComments(result.improvement[name], regex);
					}

					parseComments(result.focus, focusRegex)

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
		var deferred;
		if(!learningObjectives[course.id]){
			deferred = $.Deferred();
			iL.query("process_getCourseLearningFocus.php", { coursename: course.title + " " + course.level })
				.then(function(data){
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
