(function(window){

	/**
	 * Members module. Contains Student class.
	 *
	 * @module Members
	 */
	var iLearner = window.iLearner || {},
		Student = {},

		/* Constants */
		PHOTO_ROOT = "/c/studio/photo/",

		/* data */
		students = {},
		_students = {},
		_searches = {};

	window.iL = iLearner;
	iLearner.Student = Student;

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
			_reports[hash] = undefined;
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
						student.photo = PHOTO_ROOT + item.AccountName + ".jpg";
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

	function fetchStudent(student){
		student = students[student.id] || student;
		if(!_students[student.id]){
			_students[student.id] = Promise.resolve(
					$.post(iL.API_ROOT + "process_getMemberDetail.php", {memberID: student.id}, null, "json")
				).then(function(data){
					var courses = {};
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
								student.photo = PHOTO_ROOT + item.AccountName + ".jpg";
								student.school = item.School;
								student.phone = item.Mobile;
								student.notes = item.Remarks;

								student.birthDate = new Date(item.BirthYear, item.BirthMonth - 1, item.BirthDay);

								iL.Util.parseName(student);

								students[student.id] = student;

								// break loop
								return false;
							}
						})
					}
					if(data.memberCourseBalance){
						$.each(data.memberCourseBalance, function(i,item){
							var id = item.CourseID,
								course = courses[id] || {
									id: id,
									title: item.Coursename,
									unpaid: 0,
									code: item.CourseCode
								},
								discount = parseInt(item.Discount || item.DiscountForOldStudent),
								originalAmount = parseInt(item.Amount || item.shouldpaid),
								finalAmount = parseInt(item.AmountAfterDiscount) || originalAmount - discount,
								invoice = {
									year: parseInt(item.invoiceyear),
									month: parseInt(item.invoicemonth),
									lessonCount: parseInt(item.Nooflesson),
									paid: item.Paid == "1",
									amount: finalAmount,
									originalAmount: originalAmount,
									discount: originalAmount - finalAmount,
									handledBy: item.handleby
								};

							invoice.discountPercent = invoice.discount / originalAmount * 100;

							if(parseInt(item.DiscountForOldStudent)){
								course.existingStudent = true;
							}

							if(!course.invoices){
								course.invoices = [];
							}

							course.invoices.push(invoice);

							if(!invoice.paid){
								course.unpaid += 1;
							}

							courses[id] = course;
						});
						student.courses = courses;
					}
					return student;
				});
		}
		return _students[student.id];
	}
	Student.fetch = fetchStudent;
}(window));
