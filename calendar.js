(function(window){

	/**
	 * Calendar module. Contains Lesson and Course classes.
	 *
	 * @module Calendar
	 */
	var iLearner = window.iLearner || {},
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
		lessons = {},
		_courses = {},
		_lessons = {};

	window.iL = iLearner;
	iLearner.Lesson = Lesson;
	iLearner.Course = Course;

	/**
	 * Lesson class for dealing with lesson instances happening
	 * at a specific time on a specific date
	 *
	 * @class Lesson
	 */

	/**
	 * Get a lesson specified by its ID
	 *
	 * @method get
	 * @param id {int} Lesson ID
	 * @return {object} Object representing the lesson
	 */
	function getLesson(id){
		return lessons[id];
	}
	Lesson.get = getLesson;

	/**
	 * Find a lesson with specific conditions
	 *
	 * @method find
	 * @param options {object} A map of options
	 * @param options.start {Date} Only return lessons which start after this date
	 * @param [options.tutor] {object} Restrict lessons to only those taught by the
	 * specified tutor
	 * @return {Promise} Promise of an array of lesson objects
	 */
	function findLessons(options){
		options = $.isPlainObject(options) ? options : {
            start: new Date()
        };

		var	post_data = {
				sDate: iL.formatDate(options.start)
			},
			hash;

		if(options.tutor){
			post_data.Tutor = options.tutor.id;
		}

		hash = JSON.stringify(post_data);

		if(!_lessons[hash]){
	        _lessons[hash] = Promise.resolve(
	            $.post(iL.API_ROOT + 'process_getCalendarData.php',
	                post_data,
	                null,
	                "json")
	            ).then(function(data){
					var events = [];

					$.each(data.CalendarCourse, function(i,item){
						var start = new Date(item.ScheduleDate),
							end = new Date(item.ScheduleDate),
							tutor = iL.Tutor.find(item.Tutor, true),
							level = item.Coursetitle.match(levelRegex),
							courseTitle = item.Coursetitle.replace(levelRegex, ""),
							courseID = item.CourseID,
							lessonID = item.CourseScheduleID,

							course = courses[courseID] || {
								id: courseID,
								code: item.CourseName,
								title: courseTitle,
								level: null,
								day: start.getDay(),
								startTime: item.Starttime,
								endTime: item.endtime,
								tutor: tutor,
								lessons: []
							},
							lesson = lessons[lessonID] || {
								id: lessonID,
								start: start,
								end: end,
								room: iL.Room.find(item.Location),
								tutor: tutor,
								students: []
							};

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

						courses[course.id] = course;

						// TODO: This is wasteful, find elegant way to merge
						lesson.students.length = 0;

						lessons[lesson.id] = lesson;
						lesson.course = course;

						if(course.lessons.indexOf(lesson) == -1){
							course.lessons.push(lesson);
						}

						// lesson is about to get loaded with its known students
						// so it is safe to set and immediatly resolve the deferred
						// (no one has access to this object yet)
						//  - OK not strictly true if it already existed
						lesson._students = Promise.resolve(lesson.students);

						events.push(lesson);
					});

					$.each(data.CalendarStudent, function(i,item){
						var student = {
								id: item.MemberID,
								name: item.nickname,
								photo: item.Accountname,
								absent: item.Attendance == "0"
							},
							lesson = lessons[item.CourseScheduleID];
						iL.Util.parseName(student);
						lesson && lesson.students.push(student);
					});

					return events;
				});
		}

		return _lessons[hash];
	}
	Lesson.find = findLessons;

	/**
	 * Save lesson changes back to the server
	 *
	 * @method save
	 * @param lesson {object} lesson object
	 * @return {Promise} Promise of completion
	 */
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

	/**
	 * Get previous lesson in series of course
	 *
	 * @method prev
	 * @param lesson {object}
	 * @return {Promise} Promise of lesson object
	 */
	function previousLesson(lesson){
		if(!lesson._prev){
			lesson._prev = Course
				.lessons(lesson.course)
				.then(function(lessons){
					var index = lessons.indexOf(lesson);
					return lessons[index-1];
				});
		}
		return lesson._prev;
	}
	Lesson.prev = previousLesson;

	/**
	 * Get next lesson in series of course
	 *
	 * @method next
	 * @param lesson {object}
	 * @return {Promise} Promise of a lesson
	 */
	function nextLesson(lesson){
		if(!lesson._next){
			lesson._next = Course
				.lessons(lesson.course)
				.then(function(lessons){
					var index = lessons.indexOf(lesson);
					return lessons[index+1];
				});
		}
		return lesson._next;
	}
	Lesson.next = nextLesson;

	/**
	 * Get a collection of all future lessons of the same course
	 *
	 * @method future
	 * @param lesson {object}
	 * @return {Promise} Promise of an array of lessons
	 */
	function futureLessons(lesson){
		if(!lesson._future){
			lesson._future = Course
				.lessons(lesson.course)
				.then(function(lessons){
					var index = lessons.indexOf(lesson);
					return lessons.slice(index);
				});
		}
		return lesson._future;
	}
	Lesson.future = futureLessons;

	/**
	 * Get details of the students registered for a lesson
	 *
	 * @method students
	 * @param lesson {object}
	 * @return {Promise} An array of students
	 */
	function lessonStudents(lesson){
		if(!lesson._students){
			lesson._students = new Promise(function(resolve, reject){
				$.post(iL.API_ROOT + "process_getCourseScheduleStudents.php",
					{
						scheduleID: lesson.id
					},
					function(data){
						if(!lesson.students){
							lesson.students = [];
						}
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
						resolve(lesson.students);
					},
					"json")
				.fail(reject);
			});
		}
		return lesson._students;
	}
	Lesson.students = lessonStudents;

	/**
	 * Class to deal with courses. Courses generally run for a number of weeks
	 * and contain lesson instances
	 *
	 * @class Course
	 */

	/**
	 * Get a specific course
	 *
	 * @method get
	 * @param id {int} ID of course to get
	 * @return {object} Course object
	 */
	function getCourse(id){
		return courses[id];
	}
	Course.get = getCourse;

	/**
	 * Find courses matching given search parameters
	 *
	 * @method find
	 * @param options {object}
	 * @param [options.year] {int}
	 * @param [options.month] {int}
	 * @param [options.tutor] {object}
	 * @return {Promise} Promise of an array
	 */
	function findCourses(options){
		var now = new Date(),
			post_data = {
				searchCourseCourseYear: options.year || now.getFullYear(),
				searchCourseCourseMonth: options.month || (now.getMonth() + 1),
				searchTutor: options.tutor.id
			},
			hash = JSON.stringify(post_data);

		if(!_courses[hash]){
			_courses[hash] = Promise.resolve(
				$.post(iL.API_ROOT + 'process_getCourseList.php',
					post_data,
					null,
					"json")
				).then(function(data){
					var out = [];

					$.each(data.courselist, function(i,item){
						var id = item.CourseID,
							level = item.CourseName.match(levelRegex),
							courseTitle = item.CourseName.replace(levelRegex, ""),
							course = courses[id] || {
								id: id,
								title: courseTitle,
								code: item.coursecode,
								level: level,
								lessons: []
							};

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

						courses[id] = course;
						out.push(course);
					});

					$.each(data.courseschedule, function(i,item){
						var start = new Date(item.ScheduleDate),
							end = new Date(item.ScheduleDate),
							tutor = iL.Tutor.find(item.tutorname, true),
							courseID = item.CourseID,
							lessonID = item.CourseScheduleID,

							course = courses[courseID] || {
								id: courseID,
								lessons: []
							},
							lesson = lessons[lessonID] || {
								id: lessonID,
								start: start,
								end: end,
								room: iL.Room.find(item.location),
								tutor: tutor,
								students: []
							};

						course.day = start.getDay();
						course.startTime = item.Starttime;
						course.endTime = item.endtime;
						course.tutor = tutor;

						_setTime(start, item.Starttime);
						_setTime(end, item.endtime);

						courses[course.id] = course;

						lessons[lesson.id] = lesson;
						lesson.course = course;

						if(course.lessons.indexOf(lesson) == -1){
							course.lessons.push(lesson);
						}
					});

					return out;
				});
		}

		return _courses[hash];
	}
	Course.find = findCourses;

	/**
	 * Get all lessons for this course
	 *
	 * @method lessons
	 * @param course {object}
	 * @return {Promise} Promise of an array
	 */
	function courseLessons(course){
		if(!course._lessons){
			course._lessons = Promise.resolve(
				$.post(iL.API_ROOT + "process_getCourseDetail.php",
					{
						courseID: course.id
					},
                    null,
                    "json")
                )
                .then(function(data){
                    if(!course.lessons){
                        course.lessons = [];
                    }

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

                    return course.lessons;
			    });
		}
		return course._lessons;
	}
	Course.lessons = courseLessons;

	function pad(s){return (s<10)?"0"+s:s}

	function _setTime(date, time){
		date.setHours(time.substr(0,2));
		date.setMinutes(time.substr(2,2));
	}

}(window));
