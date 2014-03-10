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
		var options = $.isPlainObject(start) ? start : {
				start: new Date()
			},
			post_data = {
				sDate: iL.formatDate(options.start)
			},
			deferred = $.Deferred();
		$.post(iL.API_ROOT + 'process_getCalendarData.php',
			post_data,
			function(data){
				var lesson_ids = [],
					events = [];

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

					// TODO: This is wasteful, find elegant way to merge
					if(courses[course.id]){
						course = courses[course.id];
					}
					else {
						courses[course.id] = course;
					}

					// TODO: This is wasteful, find elegant way to merge
					if(lessons[lesson.id]){
						lesson = lessons[lesson.id];
						lesson.students.length = 0;
					}
					else {
						lessons[lesson.id] = lesson;
						lesson.course = course;
						course.lessons.push(lesson);
					}
					lesson_ids.push(lesson.id);

					// lesson is about to get loaded with its known students
					// so it is safe to set and immediatly resolve the deferred
					// (no one has access to this object yet)
					//  - OK not strictly true if it already existed
					lesson._students = $.Deferred();
					lesson._students.resolve(lesson.students);

					// If we don't care about empty lessons just add the lesson
					// to the result set now; otherwise wait until later and add
					// after being checked.
					if(options.showEmpty){
						events.push(lesson);
					}
				});

				$.each(data.CalendarStudent, function(i,item){
					var student = {
						id: item.MemberID,
						name: item.nickname,
						photo: item.Accountname,
						absent: item.Attendance == "0"
					};
					iL.Util.parseName(student);
					lessons[item.CourseScheduleID].students.push(student);
				});

				if(!options.showEmpty){
					$.each(lesson_ids, function(i,item){
						var lesson = lessons[item];
						if(lesson.students.length){
							events.push(lesson);
						}
					});
				}

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

	function previousLesson(lesson){
		if(!lesson._prev){
			lesson._prev = $.Deferred();
			Course.lessons(lesson.course).done(function(lessons){
				var index = lessons.indexOf(lesson);
				lesson._prev.resolve(lessons[index-1]);
			});
		}
		return lesson._prev.promise();
	}
	Lesson.prev = previousLesson;

	function nextLesson(lesson){
		if(!lesson._next){
			lesson._next = $.Deferred();
			Course.lessons(lesson.course).done(function(lessons){
				var index = lessons.indexOf(lesson);
				lesson._next.resolve(lessons[index+1]);
			});
		}
		return lesson._next.promise();
	}
	Lesson.next = nextLesson;

	function futureLessons(lesson){
		if(!lesson._future){
			lesson._future = $.Deferred();
			Course.lessons(lesson.course).done(function(lessons){
				var index = lessons.indexOf(lesson);
				lesson._future.resolve(lessons.slice(index));
			});
		}
		return lesson._future.promise();
	}
	Lesson.future = futureLessons;

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
						iL.Util.parseName(student);
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
		if(!course._lessons){
			course._lessons = $.Deferred();
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

					course.lessons.sort(function(a,b){
						return a.start.getTime() < b.start.getTime() ? -1 : 1;
					});

					course._lessons.resolve(course.lessons);
				},
				"json");
		}
		return course._lessons.promise();
	}
	Course.lessons = courseLessons;

	function pad(s){return (s<10)?"0"+s:s}

	function _setTime(date, time){
		date.setHours(time.substr(0,2));
		date.setMinutes(time.substr(2,2));
	}

}(window));
