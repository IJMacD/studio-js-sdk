(function(){
	iL.Tutor.all().then(function(tutors){
		return iL.Report.find({tutor:tutors[4]});
	})
	.then(function(reports){
		return iL.Course.lessons(reports[1].course);
	})
	.then(function(lessons){
		return iL.Lesson.students(lessons[0]);
	})
	.then(function(students){
		students.map(function(s){console.log(s.englishName)});
	});
}())