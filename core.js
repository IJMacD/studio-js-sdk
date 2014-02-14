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

	window.iL = iLearner;

	iL.API_ROOT = API_ROOT;

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

	function formatDate(date){
		return date.getFullYear() + "/" + (date.getMonth() + 1) + "/" + date.getDate();
	}


	iLearner.Login = Login;
	iLearner.Logout = Logout;
	iLearner.getTutors = getTutors;

	window.iLearner = iLearner;
}(window));
