(function(window){
	var iLearner = window.iLearner || {},
		Calendar = {},

		/* Constants */
		levelRegex = /\s*\w\d(?:\s?-\s?\w\d)?\s*/i,
		customLevels = [
			{regex: /Trinity/, level: "K"},
			{regex: /GCSE/, level: "S"},
			{regex: /St\. Mary/, level: "P"},
			{regex: /DSE/, level: "S"},
			{regex: /Starters|Movers|Flyers/, level: "K"}
		],

		/* data */
		courses = {},
		lessons = {};

	window.iL = iLearner;
	iLearner.Calendar = Calendar;

	function getLessons(start, end){
		var post_data = {
				sDate: iL.formatDate(start)
			},
			deferred = $.Deferred();
		$.post(iL.API_ROOT + 'process_getCalendarData.php',
			post_data,
			function(data){
				var events = [];
				$.each(data.CalendarCourse, function(i,item){
					var start = new Date(item.ScheduleDate),
						end = new Date(item.ScheduleDate),
						tutor = iL.findTutor(item.Tutor, true),
						level = item.Coursetitle.match(levelRegex),
						courseTitle = item.Coursetitle.replace(levelRegex, ""),

						course = {
							id: item.CourseID,
							code: item.CourseName,
							title: courseTitle,
							level: null,
							day: start.getDay(),
							startTime: item.Starttime,
							endTime: item.endtime,
							tutor: tutor
						},
						lesson = {
							id: item.CourseScheduleID,
							title: courseTitle,
							start: start,
							end: end,
							room: item.Location,
							tutor: tutor,
							course: course
						};

					start.setHours(item.Starttime.substr(0,2));
					start.setMinutes(item.Starttime.substr(2,2));
					end.setHours(item.endtime.substr(0,2));
					end.setMinutes(item.endtime.substr(2,2));

					level = level && level[0].replace(" ", "");
					if(!level){
						$.each(customLevels, function(i,cItem){
							if(cItem.regex.test(courseTitle)){
								level = cItem.level;
								return false;
							}
						});
					}
					course.level = level;

					if(courses[course.id]){
						$.extend(courses[course.id], course);
						lesson.course = courses[course.id];
					}
					else {
						courses[course.id] = course;
					}
					lessons[lesson.id] = lesson;

					events.push(lesson);
				});
				deferred.resolve(events);
			},
			"json");
		return deferred.promise();
	}
	Calendar.getLessons = getLessons;

}(window));
