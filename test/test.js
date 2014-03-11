function testChain(a,b,c){
	iL.Tutor.all().then(function(tutors){
		console.log(tutors[a].name + ":");
		return iL.Report.find({tutor:tutors[a]});
	})
	.then(function(reports){
		console.log(reports[b].course.title);
		return iL.Course.lessons(reports[b].course);
	})
	.then(function(lessons){
		console.log("on " + lessons[c].start.getDate() + "/" + (lessons[c].start.getMonth() + 1));
		return iL.Lesson.students(lessons[c]);
	})
	.then(function(students){
		students.map(function(s){console.log("- " + s.englishName)});
	})
	.catch(function(err){
		console.log("Error occured: " + err.stack);
	});
}

testChain(4,1,0);

function promisify(jQueryPromise){
	return new Promise(function(resolve,reject){
		jQueryPromise.then(resolve,reject);
	});
}

function p(j){return new Promise(function(r,e){j.then(r,e)})}
