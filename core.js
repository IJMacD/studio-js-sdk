(function(window){
	var iLearner = window.iLearner || {},
		iL = iLearner,
		$ = window.jQuery,

		Tutor = iLearner.Tutor || {},
		Room = iLearner.Room || {},
		Util = iLearner.Util || {},

		API_ROOT = (iL.Conf && iL.Conf.API_ROOT) || "/c/studio/",
		topNames = "Chan Cheng Cheung Chin Ching Chiu Choi Chow Chu Chui Chun Chung Fan Fong Foo Fu Fung Ha Hau Heung Ho Hon Hong Hooi Hui Hung Ka Kam Keung Kiu Ko Kok Kong Ku Kung Kwok Lai Lam Lau Lay Lee Leung Li Liu Lo Loong Lui Luk Lung Ma Man Mang Mo Mok Ng Ngai Pak Pang Poon Sek Shek Sheung Shiu Sit Siu So Suen Sum Sung Sze Tai Tam Tang Tin Ting To Tong Tong Tou Tsang Tse Tseung Tso Tsui Tuen Tung Wai Wan Wong Wong Wu Yam Yau Yeung Yim Yip Yiu Yu Yue Yuen".split(" "),

		memberID,
		accountName,
		adminStaff,
		classrooms,
		tutors,

		loading = $.Deferred();

	window.iL = iLearner;
	window.iLearner = iLearner;

	iLearner.Tutor = Tutor;
	iLearner.Room = Room;
	iLearner.Util = Util;

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
	iLearner.Login = Login;

	function Logout(){
		$.post(API_ROOT + "process_logout.php");
	}
	iLearner.Logout = Logout;

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

	function getTutors(id){
		var tutor;
		if(tutors && id){
			$.each(tutors, function(i,t){
				if(t.id == id){
					tutor = t;
					return false;
				}
			});
			return tutor;
		}
		var deferred = $.Deferred(),
			promise = deferred.promise();
		loading.done(function(){
			deferred.resolve(tutors);
		});
		return promise;
	}
	Tutor.get = getTutors;
	iLearner.getTutors = getTutors;

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
	Tutor.find = findTutor;
	iLearner.findTutor = findTutor;

	function getTutorColour(tutor){
		if(!tutor.hash){
			tutor.hash = SparkMD5.hash(tutor.name);
		}
		return "#"+tutor.hash.substr(0,6);
	}
	Tutor.colour = getTutorColour;

	function getRooms(id){

		if(classrooms && id){
			$.each(classrooms, function(i,c){
				if(c.id == id){
					classroom = c;
					return false;
				}
			});

			return classroom;
		}

		var deferred = $.Deferred(),
			promise = deferred.promise();
		loading.done(function(){
			deferred.resolve(classrooms);
		});
		return promise;
	}
	Room.get = getRooms;
	iLearner.getRooms = getRooms;

	function getRoom(id){
		return getRooms(id);
	}
	iLearner.getRoom = getRoom;

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
	Room.find = findRoom;
	iLearner.findRoom = findRoom;

	function formatDate(date){
		return date.getFullYear() + "/" + (date.getMonth() + 1) + "/" + date.getDate();
	}
	Util.formatDate = formatDate;
	iLearner.formatDate = formatDate;

	function parseName(person){
		var names = person.name.match(/\w+/g);

		if(!names){
			return;
		}
		else if(names.length == 1){
			// Not a lot else we can do
			person.forename = names[0];
			person.surname = "";
			person.englishName = person.forename;
			person.chineseName = person.englishName;

		}
		else if(names.length == 2){
			// Assume just English name and surname

			person.forename = names[0];
			person.surname = names[1];
			person.englishName = names[0] + " " + names[1];
			person.chineseName = person.englishName;
		}
		else if(names.length == 3){
			// Assume no English name

			person.forename = "";
			person.surname = names[0];
			person.chineseName = names[0] + " " + names[1] + " " + names[2];
			person.englishName = person.chineseName;
		}
		else if(topNames.indexOf(names[0]) > -1){
			// Name provided with English name at end

			person.forename = names[3];
			person.surname = names[0];
			person.englishName = person.forename + " " + person.surname;
			person.chineseName = names[0] + " " + names[1] + " " + names[2];
		}
		else {
			// Name provided with English name at start

			person.forename = names[0];
			person.surname = names[1];
			person.englishName = person.forename + " " + person.surname;
			person.chineseName = names[1] + " " + names[2] + " " + names[3];
		}
	}
	Util.parseName = parseName;
	iLearner.parseName = parseName;

	window.iLearner = iLearner;
}(window));
