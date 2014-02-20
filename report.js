(function(window){
	var iLearner = window.iLearner || {},
		Report = {},

		reports = {},
		learningObjectives = {},

		comments,

		learningDefaults = {wh1label: "Politeness", wh2label: "Attentiveness", wh3label: "Participation", wh4label: "Effort"},
		saveFields = "idmembercoursereportcard ap1label ap1value ap1progress ap2label ap2value ap2progress ap3label ap3value ap3progress ap4label ap4value ap4progress wh1label wh1value wh1progress wh2label wh2value wh2progress wh3label wh3value wh3progress wh4label wh4value wh4progress generalcomments suggestions learningfocus lessoncount".split(" "),
		topNames = "Chan Cheng Cheung Chin Ching Chiu Choi Chow Chu Chui Chun Chung Fan Fong Foo Fu Fung Ha Hau Heung Ho Hon Hong Hooi Hui Hung Ka Kam Keung Kiu Ko Kok Kong Ku Kung Kwok Lai Lam Lau Lay Lee Leung Li Liu Lo Loong Lui Luk Lung Ma Man Mang Mo Mok Ng Ngai Pak Pang Poon Sek Shek Sheung Shiu Sit Siu So Suen Sum Sung Sze Tai Tam Tang Tin Ting To Tong Tong Tou Tsang Tse Tseung Tso Tsui Tuen Tung Wai Wan Wong Wong Wu Yam Yau Yeung Yim Yip Yiu Yu Yue Yuen".split(" ");

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
						item.firstName = item.name.match(/^\s*(\w+)/)[1];

						if(topNames.indexOf(item.firstName) > -1){
							item.firstName = item.name.match(/(\w+)\s*$/)[1];
						}

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
	 * @param item Report
	 * @return Promise can be used to wait for results
	 */
	function save(item){
		var post_data = {},
			i, k;
		for(i in saveFields){
			k = saveFields[i];
			post_data[k] = item[k];
		}
		return $.post(iL.API_ROOT + "process_updateMemberReportCardDetail.php", post_data, null, "json");
	}
	Report.save = save;

	/**
	 * Static method to get comment templates
	 * @return Promise
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
									.replace("XXX",			"{ firstName }")
									.replace(/\bshe\b/g,	"{ pronounSubject }")
									.replace(/\bShe\b/g,	"{ pronounSubjectCapitalize }")
									.replace(/\bherself\b/g,"{ pronounReflexive }")
									.replace(/\bher\b/g,	"{ pronounPossesive }")
									.replace(/\bHer\b/g,	"{ pronounPossesiveCapitalize }")
									.replace(/\bhe\b/g,		"{ pronounSubject }")
									.replace(/\bHe\b/g,		"{ pronounSubjectCapitalize }")
									.replace(/\bhimself\b/g,"{ pronounReflexive }")
									.replace(/\bhis\b/g,	"{ pronounPossesive }")
									.replace(/\bHis\b/g,	"{ pronounPossesiveCapitalize }")
									.replace(/\bhim\b/g,	"{ pronounObject }")
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

	function setCourseLearningFocus(courseName, focus, objective){
		getCourseLearningFocus(courseName)
			.done(function(focii){
				focii[focus] = objective;
			});
	}
	Report.setCourseLearningFocus = setCourseLearningFocus;

}(window));
