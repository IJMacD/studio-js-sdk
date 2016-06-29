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
		levelRegex = /\s*(?:Pre)?[\s-]+[a-z]\d(?:\s?-\s?[a-z]\d)?\s*/i,
		customLevels = [
			{regex: /Trinity/, level: "K"},
			{regex: /GCSE/, level: "S"},
			{regex: /St\. Mary/, level: "P"},
			{regex: /DSE/, level: "S"},
			{regex: /Starters|Movers|Flyers/, level: "K"}
		],
		grades = "K1 K2 K3 P1 P2 P3 P4 P5 P6 F1 F2 F3 F4 F5 F6".split(" "),
		timeRegex = /\((\d{4})-(\d{4})\)/,

		chineseRegex = /[\u4E00-\u9FFF]/,
		mathsRegex = /(math|數)/i,
		spanishRegex = /Spanish/i,

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
	 * @param [options.tutor] {object} Restrict lessons to only those taught by the specified tutor
	 * @param [options.course] {object} Lessons from the specified course
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
			hash,
			startMoment,
			endMoment;

		if(args.length == 2){
			return _relativeLessons(args[0], args[1]);
		}

		options = $.isPlainObject(args[0]) ? args[0] : {};

		if(options.id){
			var lesson = getLesson(options.id);
			return lesson ? Promise.resolve([lesson]) : Promise.reject("No method to search for individual lessons");
		}

		if(options.student){
			var o = $.extend({},options);
			o.student = undefined;
			return findLessons(o).then(function(lessons){
				return lessons.filter(function(lesson){
					var hasStudent = false;
					lesson.attendees.forEach(function(attendee){
						if(attendee.student == options.student){
							hasStudent = true;
							return false;
						}
					});
					return hasStudent;
				});
			});
		}

		if(options.course){
			return courseLessons(options.course);
		}

		if(!options.start){
			options.start = new Date;
		}

		if(options.end){
			startMoment = moment(options.start);
			endMoment = moment(options.end);
			if(endMoment > startMoment && !startMoment.isSame(endMoment, 'day')){
				return Promise.all(getAllDays(startMoment, endMoment)
					.map(function(item){
						var op = $.extend({},options);
						op.start = item.toDate();
						op.end = undefined;
						return findLessons(op);
					})
				).then(function(days){
					return days.concat.apply([], days);
				});
			}
		}

		post_data = {
			sDate: iL.Util.formatDate(options.start)
		};

		if(options.tutor){
			post_data.Tutor = options.tutor.id;
		}

		hash = JSON.stringify(post_data);

		if(!_lessons[hash]){
			_lessons[hash] = Promise.all([
					iL.query('process_getCalendarData.php', post_data),
					iL.Room.all()
				]).then(function(results){
					var data = results[0],
						events = [];

					$.each(data.CalendarCourse, function(i,item){
						var start = new Date(item.ScheduleDate),
							end = new Date(item.ScheduleDate),
							tutor = iL.Tutor.find(item.Tutor, true),
							courseID = item.CourseID,
							lessonID = item.CourseScheduleID,
							startTime = item.Starttime,
							endTime = item.endtime, // Caution! Inconsistant API
							course,
							lesson;

						course = addCourse({
							id: courseID,
							code: item.CourseName,
							day: start.getDay(),
							tutor: tutor,
							originalTitle: item.Coursetitle
						});

						// We can helpfully set the standard start time for the course if
						// it has not already been set
						// TODO: This assumes all lesson have the same start/end time
						if(!course.startTime)
							course.startTime = startTime;
						if(!course.endTime)
							course.endTime = endTime;

						_setTime(start, startTime);
						_setTime(end, endTime);

						lesson = addLesson({
							id: lessonID,
							course: course,
							start: start,
							end: end,
							room: iL.Room.find(item.Location),
							tutor: tutor
						});



						// We have the attendees array now so we can
						// pre-emptively resolve a promise for each of the lessons.
						// // Warning these attendances don't contain `subscription` or `memberCourseID`
						// // To get hold of these you must call `Attendance.fetch()`
						_attendees[lesson.id] = Promise.resolve(lesson.attendees);

						events.push(lesson);
					});

					$.each(data.CalendarStudent, function(i,item){
						var student = iL.Student.add({
									id: item.MemberID,
									name: item.nickname,
									photo: item.Accountname
								}),
								lesson = lessons[item.CourseScheduleID],
								attendance;

						if(!lesson){
							// Calendar data provides all students for day even when filtered by teacher
							console.info("Attendance was provided for a lesson which does not exist: " + item.CourseScheduleID);
							return;
						}

						attendance = addAttendance({
							lesson: lesson,
							student: student,
							// For some reason attendance always seems to be marked as "0" for make up classes
							absent: item.Attendance == "0" && item.ismakeup == "0",
							startDate: moment(item.StartDate),
							endDate: moment(item.EndDate),
							isMakeup: item.ismakeup == "1",
							original: {
								start: moment(item.ab_scheduledate.split("-").reverse().join("-") + "T" + item.ab_starttime.substr(0,2)+":"+item.ab_starttime.substr(2)),
								end: moment(item.ab_scheduledate.split("-").reverse().join("-") + "T" + item.ab_endtime.substr(0,2)+":"+item.ab_endtime.substr(2)),
								courseName: item.ab_coursename,
								tutor: iL.Tutor.find(item.ab_tutor)
							}
						});

						iL.Subscription.find({course: lesson.course, student: student})
							.then(function(subscriptions){
								if(subscriptions.length)
								{
									attendance.subscription = subscriptions[0];
								}
							});
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
	function saveLesson(lesson){
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
				sdate: iL.Util.formatDate(lesson.start),
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
		return iL.query('process_updateCourseSchedule.php',post_data)
			.then(function(data){
				if(data.statuscode != 1){
					return Promise.reject();
				}
			});
	}
	Lesson.save = saveLesson;

	function _relativeLessons(lesson, method){
		var id = lesson.id;

		if(!_promises[id]){
			_promises[id] = {};
		}

		if(!_promises[id][method]){
			_promises[id][method] = findLessons({course:lesson.course})
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
	 * @deprecated
	 * @method attendees
	 * @param lesson {object}
	 * @return {Promise} An array of attendees
	 */
	function lessonStudents(lesson){
		return findAttendances({lesson: lesson}).then(function(attendances){
			return attendances.map(function(item){return item.student});
		});
	}

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
	 * Add a course to be tracked by the sdk
	 *
	 * @method add
	 * @param course {object} course to add
	 */
	function addCourse(course){
		var existing = resolveCourse(course);

		if(existing != course)
			$.extend(existing, course);

		if(!existing.lessons){
			existing.lessons = [];
		}

		// Assume its come from outside, so apply our niceties
		_parseCourseTitle(existing);

		if(!existing.subject){
			_setSubject(existing);
		}

		_setCoursePrice(existing);

		courses[existing.id] = existing;

		return existing;
	}
	Course.add = addCourse;

	function resolveCourse(course) {
		return courses[course.id] || course;
	}

	/**
	 * Add a lesson to be tracked by the sdk
	 *
	 * @method add
	 * @param lesson {object} lesson to add
	 */
	function addLesson(lesson){
		var existing = lessons[lesson.id] || lesson,
				// Save existing attendess so we can compare later
				attendees = existing.attendees,
				course;

		if(existing != lesson)
			$.extend(existing, lesson);

		// Choose where to take attendees array from
		// TODO: smarter merge
		if(attendees && attendees.length) {
			existing.attendees = attendees;
		}
		else if (!existing.attendees) {
			existing.attendees = [];
		}

		course = existing.course;
		if(course && course.lessons.indexOf(existing) == -1) {
			course.lessons.push(existing);
		}

		lessons[existing.id] = existing;

		return existing;
	}
	Lesson.add = addLesson;

	/**
	 * Find courses matching given search parameters
	 *
	 * @method find
	 * @param options {object}
	 * @param [options.code] {string}
	 * @param [options.title] {string}
	 * @param [options.year] {int}
	 * @param [options.month] {int}
	 * @param [options.tutor] {object}
	 * @return {Promise} Promise of an array
	 */
	function findCourses(options){
		var truncatedCode = options.code && options.code.replace(/[A-Z]+$/i,""),
				subcodeMatch = options.code && options.code.match(/[A-Z]+$/i),
				subcode = subcodeMatch && subcodeMatch[0],
				now = new Date(),
				post_data = options.code ?
					{
						searchCouseCode: truncatedCode, // [sic]
						searchSubCode: subcode
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


					// -------------------------------------------------------
					// WARNING! -- Multiple instances with the same course code may be
					// returned in any order. Must do more checks before returning the
					// first one.
					// Potentially check data.courseschedule as these are sorted by date.
					// -------------------------------------------------------


					if(course.code == options.code){
						_courses[hash] = Promise.resolve([course]);
						return false;
					}

					// -----------------------------------------------------
					// END WARNING!
					// --------------------------------------------------------


				});
				if(_courses[hash]){
					return _courses[hash];
				}
			}
			_courses[hash] = Promise.all([
					iL.query('process_getCourseList.php', post_data),
					iL.Room.all()
				]).then(function(results){
					var data = results[0],
						out = [];

					$.each(data.courselist, function(i,item){
						var id = item.CourseID,
							course = addCourse({
								id: id,
								code: item.coursecode,
								originalTitle: item.CourseName
							});

						out.push(course);
					});

					$.each(data.courseschedule, function(i,item){
						var start = new Date(item.ScheduleDate),
							end = new Date(item.ScheduleDate),
							tutor = iL.Tutor.find(item.tutorname, true),
							courseID = item.CourseID,
							lessonID = item.CourseScheduleID,
							startTime = item.Starttime,
							endTime = item.endtime,
							course,
							lesson;

						// TODO: This assumes no lesson can have a unique start/end time
						_setTime(start, startTime);
						_setTime(end, endTime);

						course = addCourse({
							id: courseID,
							day: start.getDay(),
							startTime: startTime,
							endTime: endTime,
							tutor: tutor
						}),
						lesson = addLesson({
							id: lessonID,
							course: course,
							start: start,
							end: end,
							room: iL.Room.find(item.location),
							tutor: tutor
						});

					});

					return out;
				});
		}

		return _courses[hash];
	}
	Course.find = findCourses;

	/**
	 * Save course details to the server
	 *
	 * @method save
	 * @param course {object}
	 * @return {Promise}
	 */
	function saveCourse(course){
		var code = course.code.replace(/[a-z]+$/i, ""),
				subcode = course.code.substr(code.length),
				post_data = {
					Action: "update",
					courseid: course.id,
					subject: subjectToNumber(course.subject),
					tid: (course.tutor && course.tutor.id) || 0,
					ccode: code,
					subcode: subcode,
					vacancy: 6,
					discount: course.existingDiscount,
					// TODO: Possible data corruption:
					// We've stripped out (time)? and level now we're saving without it
					// cname: course.title + " " + course.level,
					// TODO: This is an alternative where changes to course title are not possible
					cname: course.originalTitle,
					status: 1, // Enabled?
					cssid: course.room.id,
					payment: course.paymentCycle == "lesson" ? "2" : "1",
					mfee: course.pricePerMonth || 0,
					lfee: course.pricePerLesson || 0,
					remark: course.notes,
					reportcard: course.report,
					cb201505promotion: course.promotion
				};
		$.extend(post_data, objectifyGrade(course.level));
		return iL.query("process_updateCourse.php", post_data);
	}
	Course.save = saveCourse;

	/**
	 * Fetch details of a course
	 *
	 * Details  gained by fetching include payment information and fees
	 *
	 * @method fetch
	 * @param course {object}
	 * @return {object} Returns the same course object
	 */
	function courseFetch(course){

		course = resolveCourse(course);

		if(!_courseDetails[course.id]){
			_courseDetails[course.id] = Promise.all([
					iL.query("process_getCourseDetail.php", { courseID: course.id }),
					iL.Room.all()
				])
				.then(function(results){
					var data = results[0],
						details = data.coursedetail[0],
						tutor,
						level;

					if(!details){
						// Course does not exist
						return Promise.reject("Course does not exist");
					}

					tutor = iL.Tutor.get(details.TutorMemberID);

					if(!tutor && course.tutor){
						tutor = course.tutor;
						tutor.id = details.TutorMemberID;
					}

					// This sometimes comes without suffix - can screw up links
					//course.code = details.CourseCode;
					addCourse({
						id: course.id,
						originalTitle: details.CourseName,
						room: iL.Room.get(details.DefaultClassroomID),
						paymentCycle: details.DefaultPaymentCycle == "2" ? "lesson" : "month",
						existingDiscount: details.DiscountForOldStudent,
						pricePerLesson: details.LessonFee,
						pricePerMonth: details.Monthlyfee, // Note different capitalisation
						notes: details.Remark == "null" ? "" : details.Remark,
						tutor: tutor,
						level: stringifyGrade(details),
						report: details.reportcard,
						promotion: details.cb201505promotion
					});

					$.each(data.coursedetailschedule, function(i,item){
						var start = new Date(item.ScheduleDate),
							end = new Date(item.ScheduleDate),
							startTime = item.Starttime,
							endTime = item.Endtime,	// Caution! Inconsistant API
							lesson;

						// We can helpfully set the standard start time for the course if
						// it has not already been set
						// TODO: This assumes all lesson have the same start/end time
						if(!course.startTime)
							course.startTime = startTime;
						if(!course.endTime)
							course.endTime = endTime;

						_setTime(start, startTime);
						_setTime(end, endTime);

						lesson = addLesson({
							id: item.CourseScheduleID,
							course: course,
							start: start,
							end: end,
							room: iL.Room.get(item.ClassroomID),
							tutor: iL.Tutor.get(item.TutorMemberID)
						});

					});

					course.lessons.sort(function(a,b){
						return a.start.getTime() < b.start.getTime() ? -1 : 1;
					});

					// If the course doesn't contain its code then it is incomplete.
					// We need to perform a second lookup to gather the remaining data.
					if(course.code)
						return course;
					else {
						return iL.Course.find({
							title: course.title,
							tutor: course.tutor
						}).then(function (courses) {
							// Just return our original course now.
							// All the extras should have already been magically added.
							return course;
						});
					}
				});
		}
		return _courseDetails[course.id];
	}
	Course.fetch = courseFetch;

	/**
	 * Get all lessons for this course
	 * implementation for Lesson.find({course: course})
	 *
	 * @private
	 * @method courselessons
	 * @param course {object}
	 * @return {Promise} Promise of an array
	 */
	function courseLessons(course){
		course = resolveCourse(course);
		return courseFetch(course)
			.then(function(){
				return course.lessons;
			});
	}

	/**
	 * Attendance class for dealing with attendances
	 *
	 * @class Attendance
	 */

	/**
	 * Function to get an attendance record
	 *
	 * @method get
	 * @param attendance|lesson {object} Either an attendance object or a lesson
	 * @param [student] {object} If a lesson has been provided as the first parameter this must be a student
	 */
	function getAttendance(lesson, student){
		if(typeof lesson == "string"){
			return attendances[lesson];
		}
		return attendances[attendanceKey(lesson, student)];
	}
	Attendance.get = getAttendance;

	/**
	 * Function to track an attendance record
	 *
	 * @method add
	 * @param attendance {object}
	 */
	function addAttendance(attendance){
		var key = attendanceKey(attendance);

		// If this is a new attendance
		if(!attendances[key]){
			// Add attendance to lesson's internal array
			// TODO: better to always check and add only if necessary
			/**
			 * This method of getting attendees will soon be deprecated.
			 * Use Attendance.find instead
			 */
			attendance.lesson.attendees.push(attendance);
		}

		// Fill in some defaults
		if(!attendance.startDate) 					attendance.startDate = moment(null);
		if(!attendance.endDate) 						attendance.endDate = moment(null);
		if(!attendance.original) 						attendance.original = {};
		if(!attendance.original.courseName) attendance.original.courseName = "";
		if(!attendance.original.start) 			attendance.original.start = moment(null);
		if(!attendance.original.end) 				attendance.original.end = moment(null);
		if(!attendance.original.tutor) 			attendance.original.tutor = {name: "", color: "#000"};

		attendances[key] = attendance;

		return attendance;
	}
	Attendance.add = addAttendance;

	/**
	 * Function to find attendances
	 *
	 * @method find
	 * @param options {object} Options
	 * @param options.lesson {object} Lesson to fetch attendances for
	 * @param [options.student] {object} Specific student to check for in combination with lesson
	 * @param [options.fetch] {bool} Also fetch full details from the server (to include courseMemberID)
	 * @return {Promise}
	 */
	function findAttendances(options){
		if(options.lesson){
			var lesson = options.lesson,
				id = lesson.id,
				attendance;

			if(options.student){
				attendance = getAttendance(lesson, options.student);
				if (attendance) {
					return Promise.resolve([attendance]);
				};
			}

			if(options.clearCache){
				_attendees[id] = undefined;
			}

			// If we've been called from a fetch we might have all the data
			// or we might not. Check for `subscription` and if its not there
			// get it from the server.
			if(options.fetch && _attendees[id] && !_attendees[id].subscription){
				_attendees[id] = undefined;
			}

			if(!_attendees[id]){
				_attendees[id] = iL.query("process_getCourseScheduleStudents.php", { scheduleID: lesson.id })
					.then(function(data){

						if(!lesson.attendees){
							lesson.attendees = [];
						}

						$.each(data.coursestudent, function(i,item){
							var student = iL.Student.add({
									id: item.MemberID,
									name: item.Lastname,
									photo: item.Accountname
								}),
								subscriptionID = item.MemberCourseID,
								subscription = iL.Subscription.add({
									id: subscriptionID,
									course: lesson.course,
									student: student
								}),
								attendance = addAttendance({
									lesson: lesson,
									student: student,
									absent: item.absent == "1",
									isMakeup: item.isMakeup == "1"
								});

							attendance.subscription = subscription;
							attendance.absent = item.absent == "1";
						});

						return lesson.attendees;
					});
			}

			if(options.student){
				return _attendees[id].then(function(attendees){
					return [getAttendance(lesson, options.student)];
				});
			}

			return _attendees[id];
		}
	}
	Attendance.find = findAttendances;

	/**
	 * Get complete attendance record
	 *
	 * i.e. attendance may likely be missing memberCourseID
	 *
	 * @method fetch
	 * @param attendance {object}
	 * @return {Promise} returns a promise of the attendance you passed in
	 */

	/**
	 * Get complete attendance records
	 *
	 * i.e. attendances may likely be missing memberCourseID
	 *
	 * @method fetch
	 * @param attendances {array}
	 * @return {array} returns an array of the attendances you passed in
	 */
	function fetchAttendance(attendance){
		if($.isArray(attendance)){
			return attendance.map(fetchAttendance);
		}

		if(attendance.subscription){
			return Promise.resolve(attendance);
		}
		var key = attendanceKey(attendance);
		return findAttendances({lesson: attendance.lesson,fetch:true}).then(function(){
			return attendances[key];
		});
	}
	Attendance.fetch = fetchAttendance;

	/**
	 * Function to save attendance to the server
	 *
	 * @method save
	 * @param attendance {object}
	 * @return {Promise}
	 */
	function saveAttendance(attendance){
		if(!attendance.subscription){
			// Shhh but... This could infinite loop if fetchAttendance
			// for some reason doesn't supply the memberCourseID.
			// Solution is second check in then handler before
			// re-calling saveAttendance.
			if(!attendance.busy){
				attendance.busy = true;
				return fetchAttendance(attendance).then(saveAttendance);
			}
			else {
				return Promise.reject(Error("Couldn't save, couldn't get memberCourseID"));
			}
		}
		attendance.busy = undefined;
		return iL.query("process_updateStudentAttendance.php", {
			mcid: attendance.subscription.id,
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
		var attendance;
		if(arguments.length == 1){
			attendance = arguments[0];
			lesson = attendance.lesson;
			student = attendance.student;
		}
		if(!lesson || !student){
			throw new Error("Need a lesson and a student for an attendance");
		}
		return lesson.id + ":" + student.id;
	}

	function pad(s){return (s<10)?"0"+s:s}

	function _setTime(date, time){
		date.setHours(time.substr(0,2));
		date.setMinutes(time.substr(2,2));
	}

	function _setSubject(course){
		if(course.title.match(mathsRegex)){
			course.subject = "maths";
		} else if(course.title.match(chineseRegex)){
			course.subject = "chinese";
		} else if(course.title.match(spanishRegex)){
			course.subject = "spanish";
		} else {
			course.subject = "english";
		}
	}

	function _parseCourseTitle(course){
		title = course.originalTitle || course.title || "";

		course.originalTitle = course.originalTitle || title;

		var level = title.match(levelRegex),
				time = title.match(timeRegex);

		course.title = title.replace(levelRegex, "").replace(timeRegex, "");

		level = level && level[0].replace(/\s+/, "");
		if(!level){
			$.each(customLevels, function(i,cItem){
				if(cItem.regex.test(title)){
					level = cItem.level;
					return false;
				}
			});
		}
		course.level = level;

		if(time){
			course.startTime = time[1];
			course.endTime = time[2];
		}
	}

	function _setCoursePrice(course) {
		var coursePrices = iL.getCoursePrices(),
				prices;

		if(coursePrices){
			prices = coursePrices[course.title];

			if(prices){
				course.pricePerLesson = prices.pricePerLesson;
				course.existingDiscount = prices.discountOldStudent;
			}
		}
	}

	function subjectToNumber(subject){
		if(subject == "english"){
			return 1;
		} else if(subject == "chinese"){
			return 3;
		} else if(subject == "maths"){
			return 2;
		} else if(subject == "spanish"){
			return 1;	// Spanish is treated as English
		} else {
			return 4;
		}
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

	function objectifyGrade(string){
		var outGrades = {};
		grades.forEach(function(grade){
			outGrades[grade] = string.match(grade) ? 1 : 0;
		});
		return outGrades;
	}

	function getAllDays(start, end){
		var out = [],
				next = start;

		while(next < end){
			out.push(next);
			next = next.clone().add(1, 'day');
		}

		return out;
	}

	function delay(time) {
		return function (result) {
			return new Promise(function(resolve, reject) {
				setTimeout(function () {
					resolve(result);
				}, time);
			});
		}
	}

}(window));
