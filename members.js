(function(window){

	/**
	 * Members module. Contains Student class.
	 *
	 * @module Members
	 */
	var iLearner = window.iLearner || {},
		Student = {},

		/* Constants */

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
						};

					student.name = item.nickname;
					student.gender = item.Gender == "1" ? "male" : "female";
					student.grade = item.Grade;
					student.photo = item.AccountName;
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
}(window));
