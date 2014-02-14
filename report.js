(function(window){
	var iLearner = window.iLearner || {},
		Report = {},

		reports = {},

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
			promise = deferred.promise(),
			post_data = { membercourseID: item.id };

		$.post(iL.API_ROOT + "process_getMemberReportCardDetail.php",
			post_data,
			function(data){
				if(data.MemberReportCardDetail){
					$.extend(item, data.MemberReportCardDetail[0], learningDefaults);
					deferred.resolve(item);
				}
			},
			"json")
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