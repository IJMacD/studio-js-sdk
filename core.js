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

	function getMemberReportCardList(options, success, error){
		if(typeof success != "function"){
			// Results need to be sent somewhere
			return;
		}
		var post_data = {};

		options = options || {};

		if(options.tutor){
			post_data.searchTutor = options.tutor;
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
				if(data.MemberReportCardList){
					success(data.MemberReportCardList);
				}
			},
			"json")
		.fail(error);
	}

	function formatDate(date){
		return date.getFullYear() + "/" + (date.getMonth() + 1) + "/" + date.getDate();
	}


	iLearner.Login = Login;
	iLearner.Logout = Logout;
	iLearner.getTutors = getTutors;
	iLearner.getMemberReportCardList = getMemberReportCardList;

	window.iLearner = iLearner;
}(window));
