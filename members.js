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
		_students = {};

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
				searchStudentName: options.name,
				searchStudentMobile: options.phone,
				searchStudentSchool: options.school,
				searchStudentCourseYear: now.getFullYear(),
				searchStudentCourseMonth: (now.getMonth() + 1)
			};
		return Promise.resolve(
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
	Student.find = findStudents;

	function fetchStudent(student){
		if(!_students[student.id]){
			_students[student.id] = Promise.resolve(
					$.post(iL.API_ROOT + "process_getMemberDetail.php", {memberID: student.id}, null, "json")
				).then(function(data){
					if(data.memberdetail){
						$.each(data.memberdetail, function(i,item){
							var name = (item.lastname && item.Nickname) ?
								(item.lastname.length > item.Nickname.length ? item.lastname : item.Nickname) :
								(item.lastname || item.Nickname)
							if(item.isStudent == "1"){
								student.name = name;
								student.gender = item.Gender == "1" ? "male" : "female";
								student.grade = item.Grade;
								student.photo = PHOTO_ROOT + item.AccountName + ".jpg";
								student.school = item.School;
								student.phone = item.Mobile;

								student.birthDate = new Date(item.BirthYear, item.BirthMonth - 1, item.BirthDay);

								iL.Util.parseName(student);

								students[student.id] = student;

								// break loop
								return false;
							}
						})
					}
					return student;
				});
		}
		return _students[student.id];
	}
	Student.fetch = fetchStudent;
}(window));
