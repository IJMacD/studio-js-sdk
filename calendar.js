(function(window){

	/**
	 * Calendar module. Contains Lesson and Course classes.
	 *
	 * @module Calendar
	 */
	var iLearner = window.iLearner || {},
		Lesson = {},
		Course = {},
		Attendance = {},

		/* Constants */
		levelRegex = /\s*\w\d(?:\s?-\s?\w\d)?\s*/i,
		customLevels = [
			{regex: /Trinity/, level: "K"},
			{regex: /GCSE/, level: "S"},
			{regex: /St\. Mary/, level: "P"},
			{regex: /DSE/, level: "S"},
			{regex: /Starters|Movers|Flyers/, level: "K"}
		],
		grades = "K1 K2 K3 P1 P2 P3 P4 P5 P6 F1 F2 F3 F4 F5 F6".split(" "),

		/* data */
		courses = {},
		lessons = {},
		attendances = {},
		_courses = {},
		_courseDetails = {},
		_lessons = {},
		_promises = {},
		_attendees = {};

	window.iL = iLearner;
	iLearner.Lesson = Lesson;
	iLearner.Course = Course;
	iLearner.Attendance = Attendance;

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
	 * @param [options.start] {Date} Only return lessons which start after this date
	 * @param [options.tutor] {object} Restrict lessons to only those taught by the
	 * @param [options.course] {object} Lessons from the specified course
	 * specified tutor
	 * @return {Promise} Promise of an array of lesson objects
	 */

	/**
	 * Find lessons relative to a specified lesson
	 *
	 * @method find
	 * @param lesson {object} A lesson object
	 * @param method {string} parameter decribing relationship. Can be one of the following:
	 * * previous
	 * * next
	 * * future
	 * * past
	 * @return {Promise} Promise of an array of lesson objects
	 */
	function findLessons(){
		var	args = Array.prototype.slice.call(arguments),
			options,
			post_data,
			hash;

		if(args.length == 2){
			return _relativeLessons(args[0], args[1]);
		}

		options = $.isPlainObject(args[0]) ? args[0] : {};

		if(options.course){
			return courseLessons(options.course);
		}

		if(!options.start){
			options.start = new Date;
		}

		post_data = {
			sDate: iL.formatDate(options.start)
		};

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
								lessons: []
							},
							lesson = lessons[lessonID] || {
								id: lessonID,
								start: start,
								end: end,
								room: iL.Room.find(item.Location),
								tutor: tutor,
								attendees: []
							};

						course.code = item.CourseName;
						course.title = courseTitle;
						course.level = null;
						course.day = start.getDay();
						course.startTime = item.Starttime;
						course.endTime = item.endtime;
						course.tutor = tutor;

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

						lesson.attendees.length = 0;

						lessons[lesson.id] = lesson;
						lesson.course = course;

						if(!course.lessons){
							course.lessons = [];
						}

						if(course.lessons.indexOf(lesson) == -1){
							course.lessons.push(lesson);
						}

						events.push(lesson);
					});

					$.each(data.CalendarStudent, function(i,item){
						var student = iL.Student.get(item.MemberID) || {
								id: item.MemberID,
								name: item.nickname,
								photo: item.Accountname
							},
							lesson = lessons[item.CourseScheduleID],
							attendance = getAttendance(lesson, student) || {
								memberCourseID: null,
								lesson: lesson,
								student: student
							},
							key = lesson && attendanceKey(lesson, student);
						attendance.absent = item.Attendance == "0";
						iL.Util.parseName(student);
						lesson && lesson.attendees.push(attendance);
						attendances[key] = attendance;
						iL.Student.add(student);
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
			};
		return Promise.resolve(
			$.post(iL.API_ROOT + 'process_updateCourseSchedule.php', post_data)
		).then(function(data){
			if(data.statuscode != 1){
				return Promise.reject();
			}
		});
	}
	Lesson.save = save;

	function _relativeLessons(lesson, method){
		var id = lesson.id;

		if(!_promises[id]){
			_promises[id] = {};
		}

		if(!_promises[id][method]){
			_promises[id][method] = Course
				.lessons(lesson.course)
				.then(function(lessons){
					var index = lessons.indexOf(lesson);
					if(method == "previous"){
						return lessons.slice(index-1,index);
					}
					else if(method == "next"){
						return lessons.slice(index+1,index+2);
					}
					else if(method == "future"){
						// lesson inclusive
						return lessons.slice(index);
					}
					else if(method == "past"){
						// lesson inclusive
						return lessons.slice(0,index+1);
					}
				});
		}
		return _promises[id][method];
	}

	/**
	 * Get previous lesson in series of course
	 *
	 * @method prev
	 * @param lesson {object}
	 * @return {Promise} Promise of lesson object
	 */
	function previousLesson(lesson){
		return findLessons(lesson, "previous").then(function(a){return a[0]});
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
		return findLessons(lesson, "next").then(function(a){return a[0]});
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
		return findLessons(lesson, "future");
	}
	Lesson.future = futureLessons;

	/**
	 * Get details of the attendees registered for a lesson
	 *
	 * @method attendees
	 * @param lesson {object}
	 * @return {Promise} An array of attendees
	 */
	function lessonStudents(lesson){
		return findAttendance({lesson: lesson}).then(function(attendances){
			return attendances.map(function(item){return item.student});
		});
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
	 * Add a course
	 *
	 * @method add
	 * @param course {object} course to add
	 */
	function addCourse(course){
		courses[course.id] = course;
	}
	Course.add = addCourse;

	/**
	 * Find courses matching given search parameters
	 *
	 * @method find
	 * @param options {object}
	 * @param [options.title] {int}
	 * @param [options.year] {int}
	 * @param [options.month] {int}
	 * @param [options.tutor] {object}
	 * @return {Promise} Promise of an array
	 */
	function findCourses(options){
		var now = new Date(),
			post_data = options.code ?
				{
					searchCouseCode: options.code // [sic]
				}
			:
				{
					searchCourseTitle: options.title,
					searchCourseCourseYear: options.year || now.getFullYear(),
					searchCourseCourseMonth: options.month || (now.getMonth() + 1),
					searchTutor: options.tutor && options.tutor.id
				},
			hash = JSON.stringify(post_data);

		if(!_courses[hash]){
			if(options.code){
				$.each(courses, function(i,course){
					if(course.code == options.code){
						_courses[hash] = Promise.resolve([course]);
						return false;
					}
				});
				if(_courses[hash]){
					return _courses[hash];
				}
			}
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
						course.title = courseTitle;
						course.code = item.coursecode;
						course.level = level;
						course.subject = item.subject;

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
								attendees: []
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

	function courseFetch(course){
		if(!_courseDetails[course.id]){
			_courseDetails[course.id] = Promise.resolve(
				$.post(iL.API_ROOT + "process_getCourseDetail.php",
					{
						courseID: course.id
					},
					null,
					"json")
				)
				.then(function(data){
					var details = data.coursedetail[0];

					course.code = details.CourseCode;
					course.title = details.CourseName.replace(levelRegex, "");
					course.room = iL.Room.get(details.DefaultClassroomID);
					course.paymentCycle = details.DefaultPaymentCycle == "2" ? "lesson" : "monthly";
					course.existingDiscount = details.DiscountForOldStudent;
					course.pricePerLesson = details.LessonFee;
					course.pricePerMonth = details.MonthlyFee;
					course.notes = details.Remark == "null" ? "" : details.Remark;
					course.subject = null; // details.SubjectID
					course.tutor = iL.Tutor.get(details.TutorMemberID);
					course.level = stringifyGrade(details);

					if(!course.level){
						course.level = details.CourseName.match(levelRegex);
					}

					if(!course.lessons){
						course.lessons = [];
					}

					$.each(data.coursedetailschedule, function(i,item){
						var start = new Date(item.ScheduleDate),
							end = new Date(item.ScheduleDate),
							lesson;

						if(lessons[item.CourseScheduleID]){
							lesson = lessons[item.CourseScheduleID];
						}
						else {
							lesson = {
								id: item.CourseScheduleID,
								start: start,
								end: end,
								room: iL.Room.get(item.ClassroomID),
								tutor: iL.Tutor.get(item.TutorMemberID),
								course: course,
								attendees: []
							};

							_setTime(start, item.Starttime);
							_setTime(end, item.Endtime);
						}

						if(course.lessons.indexOf(lesson) == -1){
							course.lessons.push(lesson);
						}

						lessons[lesson.id] = lesson;
					});

					course.lessons.sort(function(a,b){
						return a.start.getTime() < b.start.getTime() ? -1 : 1;
					});

					return course;
				});
		}
		return _courseDetails[course.id];
	}
	Course.fetch = courseFetch;

	/**
	 * Get all lessons for this course
	 * [Sugar] for Lesson.find({course: this})
	 *
	 * @method lessons
	 * @param course {object}
	 * @return {Promise} Promise of an array
	 */
	function courseLessons(course){
		return courseFetch(course)
			.then(function(){
				return course.lessons;
			});
	}
	Course.lessons = courseLessons;

	/**
	 * Attendance class for dealing with attendances
	 *
	 * @class Student
	 */

	/**
	 * Function to get an attendance record
	 */
	function getAttendance(lesson, student){
		return attendances[attendanceKey(lesson, student)];
	}
	Attendance.get = getAttendance;

	/**
	 * Function to find attendances
	 *
	 * @param options {object} Options
	 * @param options.lesson {object} Lesson to fetch attendances for
	 * @return {Promise}
	 */
	function findAttendance(options){
		if(options.lesson){
			var lesson = options.lesson,
				id = lesson.id;
			if(!_attendees[id]){
				_attendees[id] = new Promise(function(resolve, reject){
					$.post(iL.API_ROOT + "process_getCourseScheduleStudents.php",
						{
							scheduleID: lesson.id
						},
						function(data){
							if(!lesson.attendees){
								lesson.attendees = [];
							}
							lesson.attendees.length = 0;
							$.each(data.coursestudent, function(i,item){
								var student = iL.Student.get(item.MemberID) || {
										id: item.MemberID,
										name: item.Lastname,
										photo: item.Accountname
									},
									attendance = getAttendance(lesson, student) || {
										lesson: lesson,
										student: student
									};
								iL.Util.parseName(student);

								attendance.memberCourseID = item.MemberCourseID;
								attendance.absent = item.absent == "1";

								iL.Student.add(student);
								lesson.attendees.push(attendance);
								attendances[attendanceKey(lesson, student)] = attendance;
							});
							resolve(lesson.attendees);
						},
						"json")
					.fail(reject);
				});
			}
			return _attendees[id];
		}
	}
	Attendance.find = findAttendance;

	/**
	 * Get complete attendance record,
	 * i.e. attendance may likely be missing memberCourseID
	 * @return returns the attendance you passed in
	 */
	function fetchAttendance(attendance){
		var key = attendanceKey(attendance);
		return findAttendance({lesson: attendance.lesson}).then(function(){
			return attendances[key];
		});
	}
	Attendance.fetch = fetchAttendance;

	/**
	 * Function to save attendance to the server
	 */
	function saveAttendance(attendance){
		if(!attendance.memberCourseID){
			fetchAttendance(attendance).then(saveAttendance)
			.catch(function(err){console.error(err.stack);});
			return;
		}
		$.post(iL.Conf.API_ROOT + "process_updateStudentAttendance.php", {
			mcid: attendance.memberCourseID,
			absent: attendance.absent ? 0 : 1,
			coursescheduleID: attendance.lesson.id,
			absentReason: ""
		});
	}
	Attendance.save = saveAttendance;

	/**
	 * Takes either an attendance or a lesson/student pair
	 */
	function attendanceKey(lesson, student){
		if(arguments.length == 1){
			return arguments[0].lesson.id + ":" + arguments[0].student.id;
		}
		return lesson.id + ":" + student.id;
	}

	function pad(s){return (s<10)?"0"+s:s}

	function _setTime(date, time){
		date.setHours(time.substr(0,2));
		date.setMinutes(time.substr(2,2));
	}

	function stringifyGrade(object){
		var outGrades = [];
		grades.forEach(function(grade){
			if(object[grade] == "1"){
				outGrades.push(grade);
			}
		});
		return outGrades.join("-");
	}

}(window));
