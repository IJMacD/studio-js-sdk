(function(window){

	/**
	 * Core module. Contains Tutor, Room classes as well as Utility submodule
	 *
	 * @module Core
	 */
	var iLearner = window.iLearner || {},
		iL = iLearner,
		$ = window.jQuery,

		defaults = {
			API_ROOT: "/",
			PHOTO_URL: "/photos"
		},

		Tutor = iLearner.Tutor || {},
		Room = iLearner.Room || {},
		Util = iLearner.Util || {},

		topNames = "Chan Chang Cheng Cheung Chin Ching Chiu Choi Chow Chu Chui Chun Chung Fan Fong Foo Fu Fung"
			+ " Ha Hau Heung Ho Hon Hong Hooi Hui Hung Ka Kam Keung Kiu Ko Kok Kong Ku Kung Kwok Lai Lam Lau Lay"
			+ " Lee Leung Li Liu Lo Loong Lui Luk Lung Ma Man Mang Mo Mok Ng Ngai Pak Pang Poon Sek Shek Sheung"
			+ " Shiu Sit Siu So Suen Sum Sung Sze Tai Tam Tang Tin Ting To Tong Tong Tou Tsang Tse Tseung Tso Tsui"
			+ " Tuen Tung Wai Wan Wong Wong Wu Yam Yau Yeung Yim Yip Yiu Yu Yue Yuen".split(" "),

		memberID,
		accountName,
		adminStaff,
		classrooms,
		tutors,

		loading;

	window.iL = iLearner;
	window.iLearner = iLearner;

	iL.Conf = $.extend({}, defaults, iL.Conf);

	iLearner.Tutor = Tutor;
	iLearner.Room = Room;
	iLearner.Util = Util;

	/* legacy */
	iL.API_ROOT = iL.Conf.API_ROOT;

	getInitData();

	function Login(user, pass){
		return Promise.resolve(
				$.post(
					iL.Conf.API_ROOT + "process_login.php",
					{
						login: user,
						password: pass
					},
					null,
					"json"
				)
			)
			.then(function(data){
				if(data.result && data.result[0]){
					memberID = parseInt(data.result[0].mid);
					accountName = data.result[0].acc;

					if(!memberID){
						return Promise.reject(Error("No member ID"));
					}

					return data.result[0];
				}
				else{
					return Promise.reject(Error("Invalid data from the server"));
				}
			});
	}
	iLearner.Login = Login;

	function Logout(){
		$.post(iL.Conf.API_ROOT + "process_logout.php");
	}
	iLearner.Logout = Logout;

	function getInitData(){
		loading = Promise.resolve(
			$.post(iL.Conf.API_ROOT + "process_getinitdata.php",
				null,
				null,
				"json")
			)
			.then(function(data){
				adminStaff = data.AdminStaff;
				classrooms = $.map(data.classroom, function(i){
					return { id: i.crid, name: i.place }
				});
				tutors = $.map(data.tutor, function(t){
					var tutor = { name: t.n, id: t.mid };
					tutor.colour = getTutorColour(tutor);
					return tutor;
				});
			});
	}

	/**
	 * Used for interacting with tutors
	 *
	 * @class Tutor
	 */

	/**
	 * Get all tutors
	 *
	 * @method all
	 * @return {Promise} Promise of an array containing the details of the tutors
	 */
	function allTutors(){
		return Promise.resolve(loading).then(function(){
				return tutors;
			});
	}
	Tutor.all = allTutors;

	/**
	 * Get a single tutor specified by his ID
	 *
	 * @method get
	 * @param id {int} ID of the tutor you with to fetch
	 * @return {object} Object containing the details of the tutor
	 */
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
	}
	Tutor.get = getTutors;
	iLearner.getTutors = getTutors;

	/**
	 * Find a single tutor specified by his name
	 *
	 * @method find
	 * @param name {string} Name of the tutor you with to fetch
	 * @param [fallback] {boolean} If true will return a constructed object
	 * even if a corresponding one  was not found on the server
	 * @return {object} Object containing the details of the tutor
	 */
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
			tutors && tutors.push(tutor);
		}

		return tutor;
	}
	Tutor.find = findTutor;
	iLearner.findTutor = findTutor;

	/**
	 * Get a colour associated with this tutor
	 *
	 * @method colour
	 * @param tutor {object}
	 * @return {string} Colour in the format `#FFFFFF`
	 */
	function getTutorColour(tutor){
		if(!tutor.hash){
			tutor.hash = SparkMD5.hash(tutor.name);
		}
		return "#"+tutor.hash.substr(0,6);
	}
	Tutor.colour = getTutorColour;

	/**
	 * Class for using rooms
	 *
	 * @class Room
	 */

	 /**
	  * Get a room by ID
	  *
	  * @method get
	  * @param id {int} ID of the Room to get
	  * @return {object} Object with details of the room
	  */
	function getRoom(id){
		return getRooms(id);
	}
	iLearner.getRoom = getRoom;

	/**
	 * Get all rooms
	 *
	 * @method all
	 * @return {Promise} Promise of an array rooms
	 */
	function getRooms(id){
		var classroom;

		if(classrooms && id){
			$.each(classrooms, function(i,c){
				if(c.id == id){
					classroom = c;
					return false;
				}
			});

			return classroom;
		}

		return Promise.resolve(
			loading.then(function(){return classrooms;})
		);
	}
	Room.all = getRooms;
	/* @deprecated */
	Room.get = getRooms;
	iLearner.getRooms = getRooms;

	/**
	 * Find a room by name
	 *
	 * @method find
	 * @param name {string}
	 * @return {object} Object describing room
	 */
	function findRoom(name){
		var classroom;

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

	/**
	 * Utility Class
	 *
	 * @class Util
	 */

	/**
	 * Format date in server specific format
	 *
	 * @method formatDate
	 * @static
	 * @param date {Date} Javascript Date object representing the date to format
	 * @return {string} Date in format `YYYY/m/d`
	 */
	function formatDate(date){
		return date.getFullYear() + "/" + (date.getMonth() + 1) + "/" + date.getDate();
	}
	Util.formatDate = formatDate;
	iLearner.formatDate = formatDate;

	/**
	 * Useful function to set the name on any object with a `name` property.
	 *
	 * Parses names to extract forename and surname as well as combinations
	 * for English and Chinese names. It recognises common Chinese surnames
	 * to avoid confusion with English name first vs. English name last.
	 *
	 * This method modifies the original object by adding the properties:
	 * `forename`, `surname`, `englishName` and `chineseName`.
	 *
	 * @method parseName
	 * @param person {object} Object with a `name` property
	 */
	function parseName(person){
		person.name = $.trim(person.name);

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
