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

	function get(start, end){
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
							room: iL.findRoom(item.Location),
							tutor: tutor,
							course: course,
							students: []
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

				$.each(data.CalendarStudent, function(i,item){
					var student = {
						id: item.MemberID,
						name: item.nickname,
						photo: item.Accountname,
						absent: item.Attendance == "0"
					};
					iL.parseName(student);
					if(item.attendance){
						console.log(item);
					}
					lessons[item.CourseScheduleID].students.push(student);
				});

				deferred.resolve(events);
			},
			"json");
		return deferred.promise();
	}
	Calendar.get = get;
	Calendar.getLessons = get;

	function save(lesson){
		var startHour = lesson.start.getHours(),
			endHour = lesson.end.getHours(),
			startAP = startHour < 12 ? "AM" : "PM",
			endAP = endHour < 12 ? "AM" : "PM",
			post_data = {
				Action: "update",
				insertMode: null,
				tid: lesson.tutor.id,
				cstatus:0,
				courseID: lesson.course.id,
				coursescheduleID: lesson.id,
				cssid: lesson.course.id,	// Duplicated Course ID, old and new possibly?
				csid: lesson.room.id,		// Classroom ID
				sdate: iL.formatDate(lesson.start),
				timefrom: pad(startHour),	// Yes, these *must* be padded strings and 24-hour!
				minutesfrom: pad(lesson.start.getMinutes()),
				fromdt: startAP,			// Not sure if required
				timeto: pad(endHour),		// Yes, these *must* be padded strings and 24-hour!
				minutesto: pad(lesson.end.getMinutes()),
				todt: endAP,				// Not sure if required
				mon:0,
				tue:0,
				wed:0,
				thu:0,
				fri:0,
				sat:0,
				sun:0,
				coursetypechanged:0,
				orignal_coursetype:0
			},
			deferred = $.Deferred();
		$.post(iL.API_ROOT + 'process_updateCourseSchedule.php',
			post_data,
			function(data){
				if(data.statuscode == 1){
					deferred.resolve();
				}
				else {
					deferred.reject();
				}
			},
			"json").fail(deferred.reject);
		return deferred.promise();
	}
	Calendar.save = save;

	function pad(s){return (s<10)?"0"+s:s}

}(window));
