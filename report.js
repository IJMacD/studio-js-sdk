(function(window){
	var iLearner = window.iLearner || {},
		Report = {},

		reports = {},
		learningObjectives = {},

		learningDefaults = {wh1label: "Politeness", wh2label: "Attentiveness", wh3label: "Participation", wh4label: "Effort"};

	window.iL = iLearner;
	iLearner.Report = Report;

	/**
	 * Get an array of report card stubs
	 *
	 * Returns a promise object which can be used to wait for results
	 * @param options Object describing search parameters
	 * @return Promise
	 */
	function search(options){
		var deferred = $.Deferred(),
			promise = deferred.promise(),
			post_data = {};

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

		$.post(iL.API_ROOT + "process_getMemberReportCardList.php",
			post_data,
			function(data){
				var resultSet;
				if(data.MemberReportCardList){
					resultSet = data.MemberReportCardList;
					$.each(resultSet, function(i,item){
						item.id = item.membercourseid;
						item.studentId = item.memberID;
						item.name = item.nickname;
						item.courseName = item.coursename;
						item.courseStartTime = item.starttime;
						item.courseEndTime = item.endtime;
						item.memberCourseId = item.membercourseid;
						item.complete = (item.completed == "1");
						item.tutor = options.tutor;

						// TODO: check if report already exists and don't replace it
						reports[item.id] = item;
					});
					deferred.resolve(resultSet);
				}
			},
			"json")
		.fail(deferred.reject);

		return promise;
	}
	Report.search = search;

	/**
	 * Given a report stub this method provides the full report card details
	 *
	 * Returns a promise object which can be used to wait for results
	 * @param item Report
	 * @return Promise
	 */
	function get(item){
		var deferred = $.Deferred(),
			promise = deferred.promise();

		$.when(
			$.post(iL.API_ROOT + "process_getMemberReportCardDetail.php", { membercourseID: item.id },  null, "json"),
			$.post(iL.API_ROOT + "process_getCourseLearningFocus.php", { coursename: item.courseName }, null, "json")
		)
		.done(function(a1, a2){
			var detail = a1[0].MemberReportCardDetail[0],
				focus = a2[0].CourseFocusObject[0],
				labels = "ap1label ap2label ap3label ap4label wh1label wh2label wh3label wh4label".split(" "),
				o = {},
				i;

			// wh labels from code are lowest priority
			$.extend(o, learningDefaults);

			// ap labels from second query are next priority
			if(focus){
				o.ap1label = focus.ap1;
				o.ap2label = focus.ap2;
				o.ap3label = focus.ap3;
				o.ap4label = focus.ap4;
			}

			// labels already set in detail object are highest priority
			// but by default they are set as null which would overwrite our defaults
			for(i in labels) {
				if(!detail[labels[i]]){
					detail[labels[i]] = undefined;
				}
			}

			$.extend(o, detail);

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
	 * @param item Report
	 * @return Promise can be used to wait for results
	 */
	function save(item){}
	Report.save = save;
}(window));
