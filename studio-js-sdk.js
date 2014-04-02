(function(window){

	/**
	 * Core module. Contains Tutor, Room classes as well as Utility submodule
	 *
	 * @module Core
	 */
	var iLearner = window.iLearner || {},
		iL = iLearner,
		$ = window.jQuery,

		defaults = {
			API_ROOT: "/",
			PHOTO_URL: "/photos"
		},

		Tutor = iLearner.Tutor || {},
		Room = iLearner.Room || {},
		Util = iLearner.Util || {},

		topNames = "Chan Chang Cheng Cheung Chin Ching Chiu Choi Chow Chu Chui Chun Chung Fan Fong Foo Fu Fung"
			+ " Ha Hau Heung Ho Hon Hong Hooi Hui Hung Ka Kam Keung Kiu Ko Kok Kong Ku Kung Kwok Lai Lam Lau Lay"
			+ " Lee Leung Li Liu Lo Loong Lui Luk Lung Ma Man Mang Mo Mok Ng Ngai Pak Pang Poon Sek Shek Sheung"
			+ " Shiu Sit Siu So Suen Sum Sung Sze Tai Tam Tang Tin Ting To Tong Tong Tou Tsang Tse Tseung Tso Tsui"
			+ " Tuen Tung Wai Wan Wong Wong Wu Yam Yau Yeung Yim Yip Yiu Yu Yue Yuen".split(" "),

		memberID,
		accountName,
		adminStaff,
		classrooms,
		tutors,

		loading;

	window.iL = iLearner;
	window.iLearner = iLearner;

	iL.Conf = $.extend({}, defaults, iL.Conf);

	iLearner.Tutor = Tutor;
	iLearner.Room = Room;
	iLearner.Util = Util;

	/* legacy */
	iL.API_ROOT = iL.Conf.API_ROOT;

	getInitData();

	function Login(user, pass){
		return Promise.resolve(
				$.post(
					iL.Conf.API_ROOT + "process_login.php",
					{
						login: user,
						password: pass
					},
					null,
					"json"
				)
			)
			.then(function(data){
				if(data.result && data.result[0]){
					memberID = parseInt(data.result[0].mid);
					accountName = data.result[0].acc;

					if(!memberID){
						return Promise.reject(Error("No member ID"));
					}

					return data.result[0];
				}
				else{
					return Promise.reject(Error("Invalid data from the server"));
				}
			});
	}
	iLearner.Login = Login;

	function Logout(){
		$.post(iL.Conf.API_ROOT + "process_logout.php");
	}
	iLearner.Logout = Logout;

	function getInitData(){
		loading = Promise.resolve(
			$.post(iL.Conf.API_ROOT + "process_getinitdata.php",
				null,
				null,
				"json")
			)
			.then(function(data){
				adminStaff = data.AdminStaff;
				classrooms = $.map(data.classroom, function(i){
					return { id: i.crid, name: i.place }
				});
				tutors = $.map(data.tutor, function(t){
					var tutor = { name: t.n, id: t.mid };
					tutor.colour = getTutorColour(tutor);
					return tutor;
				});
			});
	}

	/**
	 * Used for interacting with tutors
	 *
	 * @class Tutor
	 */

	/**
	 * Get all tutors
	 *
	 * @method all
	 * @return {Promise} Promise of an array containing the details of the tutors
	 */
	function allTutors(){
		return Promise.resolve(loading).then(function(){
				return tutors;
			});
	}
	Tutor.all = allTutors;

	/**
	 * Get a single tutor specified by his ID
	 *
	 * @method get
	 * @param id {int} ID of the tutor you with to fetch
	 * @return {object} Object containing the details of the tutor
	 */
	function getTutors(id){
		var tutor;
		if(tutors && id){
			$.each(tutors, function(i,t){
				if(t.id == id){
					tutor = t;
					return false;
				}
			});
			return tutor;
		}
		return Promise.resolve(
			loading.then(function(){return tutors;})
		);
	}
	Tutor.get = getTutors;
	iLearner.getTutors = getTutors;

	/**
	 * Find a single tutor specified by his name
	 *
	 * @method find
	 * @param name {string} Name of the tutor you with to fetch
	 * @param [fallback] {boolean} If true will return a constructed object
	 * even if a corresponding one  was not found on the server
	 * @return {object} Object containing the details of the tutor
	 */
	function findTutor(name, fallback){
		var tutor;

		if(!name){
			return { name: "", colour: "#999999" };
		}

		if(tutors){
			$.each(tutors, function(i,t){
				if(t.name == name){
					tutor = t;
					return false;
				}
			});
		}

		if(!tutor && fallback){
			tutor = { name: name };
			tutor.colour = getTutorColour(tutor);
			tutors.push(tutor);
		}

		return tutor;
	}
	Tutor.find = findTutor;
	iLearner.findTutor = findTutor;

	/**
	 * Get a colour associated with this tutor
	 *
	 * @method colour
	 * @param tutor {object}
	 * @return {string} Colour in the format `#FFFFFF`
	 */
	function getTutorColour(tutor){
		if(!tutor.hash){
			tutor.hash = SparkMD5.hash(tutor.name);
		}
		return "#"+tutor.hash.substr(0,6);
	}
	Tutor.colour = getTutorColour;

	/**
	 * Class for using rooms
	 *
	 * @class Room
	 */

	 /**
	  * Get a room by ID
	  *
	  * @method get
	  * @param id {int} ID of the Room to get
	  * @return {object} Object with details of the room
	  */
	function getRoom(id){
		return getRooms(id);
	}
	iLearner.getRoom = getRoom;

	/**
	 * Get all rooms
	 *
	 * @method all
	 * @return {Promise} Promise of an array rooms
	 */
	function getRooms(id){
		var classroom;

		if(classrooms && id){
			$.each(classrooms, function(i,c){
				if(c.id == id){
					classroom = c;
					return false;
				}
			});

			return classroom;
		}

		return Promise.resolve(
			loading.then(function(){return classrooms;})
		);
	}
	Room.all = getRooms;
	/* @deprecated */
	Room.get = getRooms;
	iLearner.getRooms = getRooms;

	/**
	 * Find a room by name
	 *
	 * @method find
	 * @param name {string}
	 * @return {object} Object describing room
	 */
	function findRoom(name){
		var classroom;

		if(!name){
			return { id: 0, name: "" };
		}

		if(classrooms){
			$.each(classrooms, function(i,c){
				if(c.name == name){
					classroom = c;
					return false;
				}
			});
		}

		return classroom;
	}
	Room.find = findRoom;
	iLearner.findRoom = findRoom;

	/**
	 * Utility Class
	 *
	 * @class Util
	 */

	/**
	 * Format date in server specific format
	 *
	 * @method formatDate
	 * @static
	 * @param date {Date} Javascript Date object representing the date to format
	 * @return {string} Date in format `YYYY/m/d`
	 */
	function formatDate(date){
		return date.getFullYear() + "/" + (date.getMonth() + 1) + "/" + date.getDate();
	}
	Util.formatDate = formatDate;
	iLearner.formatDate = formatDate;

	/**
	 * Useful function to set the name on any object with a `name` property.
	 *
	 * Parses names to extract forename and surname as well as combinations
	 * for English and Chinese names. It recognises common Chinese surnames
	 * to avoid confusion with English name first vs. English name last.
	 *
	 * This method modifies the original object by adding the properties:
	 * `forename`, `surname`, `englishName` and `chineseName`.
	 *
	 * @method parseName
	 * @param person {object} Object with a `name` property
	 */
	function parseName(person){
		person.name = $.trim(person.name);

		var names = person.name.match(/\w+/g);

		if(!names){
			return;
		}
		else if(names.length == 1){
			// Not a lot else we can do
			person.forename = names[0];
			person.surname = "";
			person.englishName = person.forename;
			person.chineseName = person.englishName;

		}
		else if(names.length == 2){
			// Assume just English name and surname

			person.forename = names[0];
			person.surname = names[1];
			person.englishName = names[0] + " " + names[1];
			person.chineseName = person.englishName;
		}
		else if(names.length == 3){
			// Assume no English name

			person.forename = "";
			person.surname = names[0];
			person.chineseName = names[0] + " " + names[1] + " " + names[2];
			person.englishName = person.chineseName;
		}
		else if(topNames.indexOf(names[0]) > -1){
			// Name provided with English name at end

			person.forename = names[3];
			person.surname = names[0];
			person.englishName = person.forename + " " + person.surname;
			person.chineseName = names[0] + " " + names[1] + " " + names[2];
		}
		else {
			// Name provided with English name at start

			person.forename = names[0];
			person.surname = names[1];
			person.englishName = person.forename + " " + person.surname;
			person.chineseName = names[1] + " " + names[2] + " " + names[3];
		}
	}
	Util.parseName = parseName;
	iLearner.parseName = parseName;

	window.iLearner = iLearner;
}(window));
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
(function(window){

	/**
	 * Members module. Contains Student class.
	 *
	 * @module Members
	 */
	var iLearner = window.iLearner || {},
		Student = {},
		Invoice = {},
		Subscription = {},

		/* Constants */

		/* data */
		students = {},
		subscriptions = {},
		_students = {},
		_searches = {};

	window.iL = iLearner;
	iLearner.Student = Student;
	iLearner.Subscription = Subscription;
	iLearner.Invoice = Invoice;

	/**
	 * Student class for dealing with students
	 *
	 * @class Student
	 */

	/**
	 * Get a student specified by his ID
	 *
	 * @method get
	 * @param id {int} Student ID
	 * @return {object} Object representing the student
	 */
	function getStudent(id){
		return students[id];
	}
	Student.get = getStudent;

	/**
	 * Set a student here for tracking which may have been generated elsewhere
	 * (single homogenous module solves this)
	 *
	 * @method set
	 * @param student {objcet} Student object
	 */
	function addStudent(student){
		students[student.id] = student;
	}
	Student.add = addStudent;

	/**
	 * Find students with specific conditions
	 *
	 * @method find
	 * @param options {object} A map of options
	 * @param [options.name] {string} Only return students whose name *contains* this value
	 * @return {Promise} Promise of an array of student objects
	 */
	function findStudents(options){
		var now = new Date(),
			post_data = {
				// Case-insensitive searching
				searchStudentName: options.name && options.name.toLowerCase(),
				searchStudentMobile: options.phone,
				searchStudentSchool: options.school,
				searchStudentCourseYear: options.year === undefined ? now.getFullYear() : options.year,
				searchStudentCourseMonth: options.month === undefined ? (now.getMonth() + 1) : options.month
			},
			hash = JSON.stringify(post_data);

		if(options.clearCache){
			_searches[hash] = undefined;
		};

		if(!_searches[hash]){
			_searches[hash] = Promise.resolve(
					$.post(iL.API_ROOT + "process_getMemberList.php", post_data, null, "json")
				)
				.then(function(data){
					var out = [];
					data.memberlist.forEach(function(item){
						var id = item.memberID,
							student = students[id] || {
								id: id
							},
							name = (item.Lastname && item.nickname) ?
								(item.Lastname.length > item.nickname.length ? item.Lastname : item.nickname) :
								(item.Lastname || item.nickname);

						name = $.trim(name);
						student.name = name;
						student.gender = item.Gender == "1" ? "male" : "female";
						student.grade = item.Grade;
						student.account = item.AccountName;
						student.photo = iL.Conf.PHOTO_URL + item.AccountName + ".jpg";
						student.school = item.School;
						student.phone = item.mobile;
						student.registeredDate = new Date(item.RegDate);

						iL.Util.parseName(student);

						students[id] = student;
						out.push(student);
					});
					return out;
				});
		}

		return _searches[hash];
	}
	Student.find = findStudents;


	/**
	 * Get details of the students registered for a lesson
	 */
	function lessonStudents(lesson){
		var id = lesson.id;
		if(!_students[id]){
			_students[id] = new Promise(function(resolve, reject){
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
									photo: item.Accountname
								},
								attendance = {
									memberCourseID: item.MemberCourseID,
									lesson: lesson,
									student: student,
									absent: item.absent == "1"
								};
							iL.Util.parseName(student);

							students[student.id] = student;
							lesson.students.push(attendance);
							attendances[attendanceKey(lesson, student)] = attendance;
						});
						resolve(lesson.students);
					},
					"json")
				.fail(reject);
			});
		}
		return _students[id];
	}

	function fetchStudent(student){
		student = students[student.id] || student;
		if(!_students[student.id]){
			_students[student.id] = Promise.resolve(
					$.post(iL.API_ROOT + "process_getMemberDetail.php", {memberID: student.id}, null, "json")
				).then(function(data){
					var guardians = [],
						guardian,
						subs = {};
					if(data.memberdetail){
						$.each(data.memberdetail, function(i,item){
							var name = (item.lastname && item.Nickname) ?
								(item.lastname.length > item.Nickname.length ? item.lastname : item.Nickname) :
								(item.lastname || item.Nickname);
							name = $.trim(name);
							if(item.isStudent == "1"){
								student.name = name;
								student.gender = item.Gender == "1" ? "male" : "female";
								student.grade = item.Grade;
								student.account = item.AccountName;
								student.photo = iL.Conf.PHOTO_URL + item.AccountName + ".jpg";
								student.school = item.School;
								student.phone = item.Mobile;
								student.notes = item.Remarks;
								student.birthDate = new Date(item.BirthYear, item.BirthMonth - 1, item.BirthDay);

								/* Not currently used but need to
								   look after them in order to
								   be able to save */
								student.notesPayment = item.RemarkAboutPayment;
								student.nameChinese = item.Chiname;
								student.schoolStart = item.schooltimefrom;
								student.schoolEnd = item.schooltimeto;
								student.soco = item.isSOCO == "1";
								student.entryChannel1 = item.whyjoinusextendtext1;
								student.entryChannel2 = item.whyjoinusextendtext2;

								iL.Util.parseName(student);

								student.guardians = guardians;

								students[student.id] = student;

								// break loop
								return false;
							}
							else if(item.isGuardian == "1"){
								guardian = {
									accountID: item.AccountName,
									relationship: item.Relationship,
									name: item.lastname,
									nameChinese: item.Chiname,
									nickname: item.Nickname,
									email: item.emailaddress,
									address: item.Address,
									occupation: item.Occupation,
									phone: item.Mobile,
									phoneHome: item.HomeNo,
									phoneOffice: item.OfficeNo
								};
								guardians.push(guardian);
							}
						});
					}
					if(data.memberCourseBalance){
						$.each(data.memberCourseBalance, function(i,item){
							var courseID = item.CourseID,
								lessonCount = parseInt(item.Nooflesson),
								fullPrice = parseInt(item.shouldpaid),
								pricePerLesson = fullPrice / lessonCount,
								dateIndex,
								course = iL.Course.get(courseID) || {
									id: courseID
								},
								subscription = iL.Subscription.get(course, student) || {
									id: null,	// should be memberCourseID but we don't have it here
									course: course,
									student: student,
									invoices: []
								},

								/*
									- Discount, Amount, AmountAfterDiscount are for *PAID* invoices
									- shouldpaid is full price for future lesson
								*/

								discount = parseInt(item.Discount) || 0,
								originalAmount = parseInt(item.Amount) || fullPrice,
								finalAmount = parseInt(item.AmountAfterDiscount) || originalAmount - discount,
								invoice = {
									id: item.MemberCourseInvoiceID,
									year: parseInt(item.invoiceyear),
									month: parseInt(item.invoicemonth),
									lessonCount: lessonCount,
									paid: item.Paid == "1",
									amount: finalAmount,
									originalAmount: originalAmount,
									discount: originalAmount - finalAmount,
									handledBy: item.handleby,
									memberID: item.memberID,
									memberCourseID: item.membercourseID
								};

							course.title = item.Coursename;
							course.code = item.CourseCode;
							/* This is the potential discount for existing students,
							   on this subscription.
							   The student is *not* necessarily entitled to this */
							course.existingDiscount = parseInt(item.DiscountForOldStudent);
							course.pricePerLesson = pricePerLesson;

							subscription.unpaid = 0;
							subscription.withdrawn = item.withdrawal == "1";
							subscription.existingStudent = false;
							subscription.lastPaymentIndex = 0;

							iL.Course.add(course);
							iL.Subscription.add(subscription);

							dateIndex = invoice.year * 100 + invoice.month;

							if(invoice.paid && dateIndex > subscription.lastPaymentIndex
								&& subscription.existingDiscount){
								subscription.existingStudent =
									(invoice.discount / invoice.lessonCount >= subscription.existingDiscount);
								subscription.lastPaymentIndex = dateIndex;
							}

							if(!subscription.invoices){
								subscription.invoices = [];
							}

							subscription.invoices.push(invoice);

							if(!invoice.paid){
								subscription.unpaid += 1;
							}

							subs[subscriptionKey(subscription)] = subscription;
						});

						student.subscriptions = subs;
					}
					return student;
				});
		}
		return _students[student.id];
	}
	Student.fetch = fetchStudent;

	function saveStudent(student){
		var guardian = student.guardians[0],
			post_data = {
				Action:"update",
				MemberID: student.id,
				MemberDetailNameinEnglish: student.englishName,
				MemberDetailRemark: student.notes,
				MemberDetailRemarkPayment: student.notesPayment,
				MemberDetailNameinChinese: student.nameChinese,
				MemberDetailNickname: student.name,
				MemberDetailBirthDay: iL.Util.formatDate(student.birthDate),
				MemberDetailGender: student.gender == "male" ? "1" : "0",
				MemberDetailGrade: student.grade,
				MemberDetailSchool: student.school,
				MemberDetailSchooltimefrom: student.schoolStart,
				MemberDetailSchooltimeto: student.schoolEnd,
				isSOCO: student.soco ? 1 : 0,
				GuardianDetailMemberID: guardian.accountID,
				GuardianDetailRelationship: guardian.relationship,
				GuardianDetailNameinEnglish: guardian.name,
				GuardianDetailNameinChinese: guardian.nameChinese,
				GuardianDetailNickname: guardian.nickname,
				GuardianDetailEmail: guardian.email,
				GuardianDetailAddress: guardian.address,
				GuardianDetailOccupation: guardian.occupation,
				GuardianDetailHomeNo: guardian.phoneHome,
				GuardianDetailMobileNo: student.phone,	/* Be careful! At the moment this is echoed back for both the
														   student and guardian but it is only saved under the guardian. We
														   keep track of it as part of the student for simplicity, which is
														   why we're using that value here - just incase it has been modified
														   on the student */
				GuardianDetailOfficeNo: guardian.phoneOffice,
				whyjoinusextendtext1: student.entryChannel1,
				whyjoinusextendtext2: student.entryChannel2
			};
		return Promise.resolve(
			$.post(iL.API_ROOT + "process_updateMemberInformation.php", post_data, null, "json")
		);
	}
	Student.save = saveStudent;


	/**
	 * Invoice class for dealing with invoices
	 *
	 * @class Student
	 */

	/**
	 * Function to commit invoices to the server
	 */
	function saveInvoice(invoice){
		var post_data = {
				MemberCourseID: invoice.memberCourseID,
				InvoiceYear: invoice.year,
				InvoiceMonth: invoice.month,
				shouldpay: invoice.originalAmount,
				AmountAfterDiscount: invoice.amount,
				paymentmethod: invoice.paymentMethod == "cash" ? 1 : 2,
				ChequeNo: invoice.chequeNumber,
				CouponCode: invoice.coupons.join(","),
				issuedate: invoice.date,
				htmlselect_Discountvalue_val: invoice.originalAmount - invoice.amount,
				htmlselect_Discounttype_val: 1	// dollars
			};
		return Promise.resolve(
			$.post(iL.API_ROOT + "process_updateMemberInvoice.php", post_data, null, "json")
		).then(function(data){
			invoice.id = data.iID;
			invoice.handledBy = data.handle;
			invoice.paid = true;
		});
	}
	Invoice.save = saveInvoice;

	function voidInvoice(invoice, reason){
		var post_data = {
				membercourseinvoiceID: invoice.id,
				reason: reason
			};
		return Promise.resolve(
			$.post(iL.API_ROOT + "process_removeMemberInvoice.php", post_data, null, "json")
		).then(function(data){
			invoice.id = 0;
			invoice.handledBy = undefined;
			invoice.paid = false;
		});
	}
	Invoice.voidInvoice = voidInvoice;

	function getSubscription(id){
		var key = subscriptionKey.apply(null, arguments);
		return subscriptions[key];
	}
	Subscription.get = getSubscription;

	function addSubscription(subscription){
		var key = subscriptionKey(subscription);
		subscriptions[key] = subscription;
	}
	Subscription.add = addSubscription;

	function subscriptionKey(course, student){
		var args = arguments;
		if(args.length == 2){
			return course.id + ":" + student.id;
		}
		return args[0].course.id + ":" + args[0].student.id;
	}

}(window));
(function(window){

	/**
	 * Report module. Contains Report class.
	 *
	 * @module Report
	 */
	var iLearner = window.iLearner || {},
		Report = {},

		_reports = {},
		reports = {},
		learningObjectives = {},

		comments,

		learningDefaults = {wh1label: "Politeness", wh2label: "Attentiveness", wh3label: "Participation", wh4label: "Effort"},
		saveFields = "idmembercoursereportcard ap1label ap1value ap1progress ap2label ap2value ap2progress ap3label ap3value ap3progress ap4label ap4value ap4progress wh1label wh1value wh1progress wh2label wh2value wh2progress wh3label wh3value wh3progress wh4label wh4value wh4progress generalcomments suggestions learningfocus lessoncount".split(" ");

	window.iL = iLearner;
	iLearner.Report = Report;

	/**
	 * Class for dealing with report cards
	 *
	 * @class Report
	 */

	/**
	 * Get a specific report by ID
	 *
	 * @method get
	 * @param id {int}
	 * @return {object}
	 */
	function getReport(id){
		return reports[id];
	}
	Report.get = getReport;

	/**
	 * Get an array of report card stubs
	 *
	 * @method find
	 * @param options {object} Object describing search parameters
	 * @param [options.tutor] {object} Only get reports for this tutor
	 * @param [options.from] {Date} Reports for lessons which occur after this date
	 * @param [options.to] {Date} Reports for lessons which occur before this date
	 * @param [options.clearCache] {boolean} Do not fetch from the cache, instead hit server
	 * @return {Promise} Returns a promise object which can be used to wait for results
	 */
	function find(options){
		var post_data = {},
			hash;

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

		hash = JSON.stringify(post_data);

		if(options.clearCache){
			_reports[hash] = undefined;
		}

		if(!_reports[hash]){
			_reports[hash] = Promise.resolve(
				$.post(iL.API_ROOT + "process_getMemberReportCardList.php",
					post_data,
					null,
					"json")
				)
				.then(function(data){
					var resultSet;
					if(data.MemberReportCardList){
						resultSet = data.MemberReportCardList;
						$.each(resultSet, function(i,item){
							item.id = item.membercourseid;
							item.studentId = item.memberID;
							item.name = item.nickname;
							item.course = {
								id: item.courseID,
								title: item.coursename,
								startTime: item.starttime,
								endTime: item.endtime
							};
							item.memberCourseId = item.membercourseid;
							item.complete = (item.completed == "1");
							item.tutor = options.tutor;

							iL.parseName(item);

							// TODO: check if report already exists and don't replace it
							reports[item.id] = item;
						});
					}
					return resultSet;
				});
		}

		return _reports[hash];
	}
	Report.find = find;

	/**
	 * Given a report stub this method provides the full report card details
	 *
	 * @method fetch
	 * @param item {object} Report
	 * @return {Promise} Returns a promise object which can be used to wait for results
	 */
	function fetchReport(item){
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
	Report.fetch = fetchReport;

	/**
	 * When provided with a full report object this method will save the report
	 * back to the server.
	 *
	 * @method save
	 * @param item {object} Report
	 * @return {Promise} can be used to wait for results
	 */
	function save(item){
		var post_data = {},
			i, k;
		item.complete = true;
		for(i in saveFields){
			k = saveFields[i];
			post_data[k] = item[k];
		}
		return $.post(iL.API_ROOT + "process_updateMemberReportCardDetail.php", post_data, null, "json");
	}
	Report.save = save;

	/**
	 * Static method to get comment templates
	 *
	 * @method getComments
	 * @static
	 * @return {Promise} Promise of an array
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
									.replace("XXX",			"{ forename }")
									.replace(/\bshe\b/g,	"{ pronounSubject }")
									.replace(/\bShe\b/g,	"{ pronounSubjectCapitalize }")
									.replace(/\bherself\b/g,"{ pronounReflexive }")
									.replace(/\bher\b/g,	"{ pronounPossesive }")
									.replace(/\bHer\b/g,	"{ pronounPossesiveCapitalize }")
									.replace(/\bgirl\b/g,	"{ nounGender }")
									.replace(/\bhe\b/g,		"{ pronounSubject }")
									.replace(/\bHe\b/g,		"{ pronounSubjectCapitalize }")
									.replace(/\bhimself\b/g,"{ pronounReflexive }")
									.replace(/\bhis\b/g,	"{ pronounPossesive }")
									.replace(/\bHis\b/g,	"{ pronounPossesiveCapitalize }")
									.replace(/\bhim\b/g,	"{ pronounObject }")
									.replace(/\bboy\b/g,	"{ nounGender }")
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

	/**
	 * Get Learning focuses for courses
	 *
	 * @method getCourseLearningFocus
	 * @static
	 * @param courseName {string}
	 * @return {Promise} Promise of an array
	 */
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

	/**
	 * Set course learning objective for a course
	 *
	 * DOES NOT save back to server, only for current session
	 *
	 * @method setCourseLearningFocus
	 * @static
	 * @param courseName {string}
	 * @param focus {string} Which of the four fields to set
	 * @param objective {string} Actual text of the objective
	 */
	function setCourseLearningFocus(courseName, focus, objective){
		getCourseLearningFocus(courseName)
			.done(function(focii){
				focii[focus] = objective;
			});
	}
	Report.setCourseLearningFocus = setCourseLearningFocus;

}(window));
