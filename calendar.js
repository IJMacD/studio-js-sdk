(function(window){
	var iLearner = window.iLearner || {},
		Calendar = {},
		Lesson = {},
		Course = {},

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
	iLearner.Lesson = Lesson;
	iLearner.Course = Course;
	/* @deprecated */
	iLearner.Calendar = Calendar;

	function getLesson(id){
		return lessons[id];
	}
	Lesson.get = getLesson;

	function searchLessons(start, end){
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
							tutor: tutor,
							lessons: []
						},
						lesson = {
							id: item.CourseScheduleID,
							start: start,
							end: end,
							room: iL.findRoom(item.Location),
							tutor: tutor,
							students: []
						},

						_lessons;

					_setTime(start, item.Starttime);
					_setTime(end, item.endtime);

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
						course = courses[course.id];
					}
					else {
						courses[course.id] = course;
					}

					if(lessons[lesson.id]){
						lesson = lessons[lesson.id];
						lesson.students.length = 0;
					}
					else {
						lessons[lesson.id] = lesson;
						lesson.course = course;
						course.lessons.push(lesson);
					}

					events.push(lesson);
				});

				$.each(data.CalendarStudent, function(i,item){
					var student = {
						id: item.MemberID,
						name: item.nickname,
						photo: item.Accountname,
						absent: item.Attendance == "0"
					};
					iL.Util.parseName(student);
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
	Lesson.search = searchLessons;
	/* @deprecated */
	Calendar.get = searchLessons;
	/* @deprecated */
	Calendar.getLessons = searchLessons;

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
	Lesson.save = save;
	/* @deprecated */
	Calendar.save = save;

	function previousLesson(lesson){}
	Lesson.prev = previousLesson;

	function nextLesson(lesson){}
	Lesson.next = nextLesson;

	function lessonStudents(lesson){
		if(!lesson._students){
			lesson._students = $.Deferred();
			$.post(iL.API_ROOT + "process_getCourseScheduleStudents.php",
				{
					scheduleID: lesson.id
				},
				function(data){
					lesson.students.length = 0;
					$.each(data.coursestudent, function(i,item){
						var student = {
								id: item.MemberID,
								name: item.Lastname,
								photo: item.Accountname,
								absent: item.absent == "1"
							};
						lesson.students.push(student);
					});
					lesson._students.resolve(lesson.students);
				},
				"json");
		}
		return lesson._students.promise();
	}
	Lesson.students = lessonStudents;

	function getCourse(id){
		return courses[id];
	}
	Course.get = getCourse;

	function courseLessons(course){
		var deferred = $.Deferred();
		$.post(iL.API_ROOT + "process_getCourseDetail.php",
			{
				courseID: course.id
			},
			function(data){
				$.each(data.coursedetailschedule, function(i,item){
					if(lessons[item.CourseScheduleID]){
						return;
					}

					var start = new Date(item.ScheduleDate),
						end = new Date(item.ScheduleDate),
						lesson = {
							id: item.CourseScheduleID,
							start: start,
							end: end,
							room: iL.Room.get(item.ClassroomID),
							tutor: iL.Tutor.get(item.TutorMemberID),
							course: course,
							students: []
						};

					_setTime(start, item.Starttime);
					_setTime(end, item.Endtime);

					course.lessons.push(lesson);

				});
				deferred.resolve(course.lessons);
			},
			"json");
		return deferred.promise();
	}
	Course.lessons = courseLessons;

	function pad(s){return (s<10)?"0"+s:s}

	function _setTime(date, time){
		date.setHours(time.substr(0,2));
		date.setMinutes(time.substr(2,2));
	}

}(window));
