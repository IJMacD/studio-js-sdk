(function(window){
	var iLearner = window.iLearner || {},
		iL = iLearner,
		$ = window.jQuery,

		API_ROOT = "/c/studio/",
		topNames = "Chan Cheng Cheung Chin Ching Chiu Choi Chow Chu Chui Chun Chung Fan Fong Foo Fu Fung Ha Hau Heung Ho Hon Hong Hooi Hui Hung Ka Kam Keung Kiu Ko Kok Kong Ku Kung Kwok Lai Lam Lau Lay Lee Leung Li Liu Lo Loong Lui Luk Lung Ma Man Mang Mo Mok Ng Ngai Pak Pang Poon Sek Shek Sheung Shiu Sit Siu So Suen Sum Sung Sze Tai Tam Tang Tin Ting To Tong Tong Tou Tsang Tse Tseung Tso Tsui Tuen Tung Wai Wan Wong Wong Wu Yam Yau Yeung Yim Yip Yiu Yu Yue Yuen".split(" "),

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
				classrooms = $.map(data.classroom, function(i){
					return { id: i.crid, name: i.place }
				});
				tutors = $.map(data.tutor, function(t){
					var tutor = { name: t.n, id: t.mid };
					tutor.colour = getTutorColour(tutor);
					return tutor;
				});
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

	function getRooms(){
		var deferred = $.Deferred(),
			promise = deferred.promise();
		loading.done(function(){
			deferred.resolve(classrooms);
		});
		return promise;
	}
	iLearner.getRooms = getRooms;

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
	iLearner.findTutor = findTutor;

	function findRoom(name){
		var room;

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
	iLearner.findRoom = findRoom;

	function getTutorColour(tutor){
		if(!tutor.hash){
			tutor.hash = SparkMD5.hash(tutor.name);
		}
		return "#"+tutor.hash.substr(0,6);
	}

	function formatDate(date){
		return date.getFullYear() + "/" + (date.getMonth() + 1) + "/" + date.getDate();
	}
	iLearner.formatDate = formatDate;

	function parseName(person){
		var firstRegex = /^\s*(\w+)/,
			firstName = person.name.match(firstRegex)[1],
			lastRegex = /(\w+)\s*$/,
			lastName,
			chineseName;

		if(topNames.indexOf(firstName) > -1){
			lastName = person.name.match(lastRegex)[1];

			person.forename = lastName;
			person.surname = firstName;
			person.englishName = person.forename + " " + person.surname;
			person.chineseName = $.trim(person.name.replace(lastRegex, ""));
		}
		else {
			chineseName = $.trim(person.name.replace(firstRegex,""));

			person.forename = firstName;
			person.surname = chineseName.match(firstRegex)[1];
			person.englishName = person.forename + " " + person.surname;
			person.chineseName = chineseName;
		}
	}
	iLearner.parseName = parseName;


	iLearner.Login = Login;
	iLearner.Logout = Logout;
	iLearner.getTutors = getTutors;

	window.iLearner = iLearner;
}(window));
