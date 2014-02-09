(function(window){
	var iLearner = window.iLearner || {},
		iL = iLearner,
		$ = window.jQuery,

		API_ROOT = "/c/studio/",

		memberID,
		accountName,
		adminStaff,
		classrooms,
		tutors,

		loading = $.Deferred();

	getInitData();

	function Login(user, pass, success, error){
		$.post(API_ROOT + "process_login.php",
			{
				login: user,
				password: pass
			},
			function(data){
				if(data.result && data.result[0]){
					memberID = parseInt(data.result[0].mid);
					accountName = data.result[0].acc;

					if(!memberID){
						if(typeof error == "function"){
							error();
						}
						return;
					}

					if(typeof success == "function"){
						success(data.result[0]);
					}
				}
				else if(typeof error == "function"){
					error();
				}
			},
			"json")
		.fail(error);
	}

	function Logout(){
		$.post(API_ROOT + "process_logout.php");
	}

	function getInitData(){
		$.post(API_ROOT + "process_getinitdata.php",
			null,
			function(data){
				adminStaff = data.AdminStaff;
				classrooms = data.classroom;
				tutors = $.map(data.tutor, function(t){ return { name: t.n, id: t.mid }; });
				loading.resolve();
			},
			"json");
	}

	function getTutors(){
		var deferred = $.Deferred(),
			promise = deferred.promise();
		loading.done(function(){
			deferred.resolve(tutors);
		});
		return promise;
	}

	function getMemberReportCardList(options){
		var deferred = $.Deferred(),
			promise = deferred.promise(),
			post_data = {};

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

		$.post(API_ROOT + "process_getMemberReportCardList.php",
			post_data,
			function(data){
				var students;
				if(data.MemberReportCardList){
					students = $.map(data.MemberReportCardList, function(i){
						i.id = i.membercourseid;
						i.studentId = i.memberID;
						i.name = i.nickname;
						i.courseName = i.coursename;
						i.courseStartTime = i.starttime;
						i.courseEndTime = i.endtime;
						i.memberCourseId = i.membercourseid;
						i.complete = (i.completed == "1");
						i.tutor = options.tutor;

						return i;
					})
					deferred.resolve(students);
				}
			},
			"json")
		.fail(deferred.reject);

		return promise;
	}

	function getMemberReportCardDetail(options){
		var deferred = $.Deferred(),
			promise = deferred.promise(),
			post_data = { membercourseID: options.memberCourseId };

		$.post(API_ROOT + "process_getMemberReportCardDetail.php",
			post_data,
			function(data){
				if(data.MemberReportCardDetail){
					deferred.resolve(data.MemberReportCardDetail[0]);
				}
			},
			"json")
		.fail(deferred.reject);

		return promise;
	}

	function formatDate(date){
		return date.getFullYear() + "/" + (date.getMonth() + 1) + "/" + date.getDate();
	}


	iLearner.Login = Login;
	iLearner.Logout = Logout;
	iLearner.getTutors = getTutors;
	iLearner.getMemberReportCardList = getMemberReportCardList;
	iLearner.getMemberReportCardDetail = getMemberReportCardDetail;

	window.iLearner = iLearner;
}(window));
