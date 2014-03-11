(function(){
	iL.Tutor.all().then(function(tutors){
		var tutorStudentMap = {},
			promises = [];
		tutors.forEach(function(tutor){
			var promise = iL.Report.find({tutor:tutor});
			promise.then(function(studenmap){
				var map = {},
					arr = [];
				studenmap.forEach(function(student){
					map[student.name] = 0;
				});
				for(name in map){
					arr.push(name);
				}
				arr.sort();
				tutorStudentMap[tutor.name] = arr;
			});
			promises.push(promise);
		});
		Promise.all(promises).then(function(){
			var out = ["<ul>"];
			for(tutor in tutorStudentMap){
				out.push("<li>"+tutor+"<ol>");
				for(i in tutorStudentMap[tutor]){
					out.push("<li>"+tutorStudentMap[tutor][i]);
				}
				out.push("</ol>");
			}
			out.push("</ul>");
			$('body').html(out.join(""));
		});
	});
}());