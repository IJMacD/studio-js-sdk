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
		Term = iLearner.Term || {},
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
		terms,

		loading;

	window.iL = iLearner;
	window.iLearner = iLearner;

	iL.Conf = $.extend({}, defaults, iL.Conf);

	iLearner.Tutor = Tutor;
	iLearner.Room = Room;
	iLearner.Term = Term;
	iLearner.Util = Util;

	/* legacy */
	iL.API_ROOT = iL.Conf.API_ROOT;

	iL.query = query;

	getInitData();

	function Login(user, pass){
		return query("process_login.php", { login: user, password: pass })
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
		iL.query("process_logout.php");
	}
	iLearner.Logout = Logout;

	function getInitData(){
		loading = iL.query("process_getinitdata.php")
			.then(function(data){
				adminStaff = data.AdminStaff;
				classrooms = $.map(data.classroom, function(i){
					return { id: i.crid, name: i.place }
				});
				terms = data.term.map(function(term){
					return {
						id: term.idStudioTerms,
						year: term.TermYear,
						name: term.Term,
						start: new Date(term.Startdate),
						end: new Date(term.Enddate)
					}
				});
				tutors = $.map(data.tutor, function(t){
					var tutor = { name: $.trim(t.n), id: t.mid };
					tutor.colour = getTutorColour(tutor);
					return tutor;
				});
			});
	}

	function query(url, data){
		return new Promise(function(resolve, reject){
			$.post(iL.Conf.API_ROOT + url, data, null, "json")
				.then(resolve, function(xhr, status, error){
					console.error(status + " in file " + url);
					reject(error);
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
		return loading.then(function(){
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

	/**
	 * Find a single tutor specified by his name
	 *
	 * @method find
	 * @param name {string} Name of the tutor you with to fetch
	 * @param [fallback] {boolean} If true will return a constructed object
	 * even if a corresponding one	was not found on the server
	 * @return {object} Object containing the details of the tutor
	 */
	function findTutor(name, fallback){
		var tutor;

		if(!name){
			return { name: "", colour: "#999999" };
		}

		name = $.trim(name);

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
	Room.get = getRoom;

	/**
	 * Get all rooms
	 *
	 * @method all
	 * @return {Promise} Promise of an array of rooms
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

		return loading.then(function(){return classrooms;});
	}
	Room.all = getRooms;

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

	/**
	 * Class for using terms
	 *
	 * @class Term
	 */

	/**
	 * Get all terms
	 *
	 * @method all
	 * @return {Promise} Promise of an array of terms
	 */
	function allTerms(){
		return loading.then(function(){return terms;});
	}
	Term.all = allTerms;

	/**
	 * Find a term based on criteria
	 *
	 * @method find
	 * @param options {object} map of options
	 * @return {Promise} Promise of an array of terms
	 */
	function findTerm(options){
		if(!options){
			return Promise.reject(new Error("No options specified for finding a term"));
		}

		return allTerms().then(function(terms){
			var now,
				term;

			if(options.current){
				now = new Date();

				terms.forEach(function(t){
					if(t.start < now && t.end > now){
						term = t;
						return false;
					}
				});

				return term;
			}

			if(options.mostRecent){
				now = new Date();

				terms.forEach(function(t){
					term = t;
					if(t.start < now && t.end > now){
						return false;
					}
				});

				return term;
			}

			return Promise.reject(new Error("No options specified for finding a term"))
		});
	}
	Term.find = findTerm;

	/**
	 * Get a term based on id
	 *
	 * @method find
	 * @param id {int} ID
	 * @return {object} Term
	 */
	function getTerm(id){
		var term;

		if(!terms){
			return
		}

		terms.forEach(function(t){
			if(t.id == id){
				term = t;
				return false;
			}
		});

		return term;
	}
	Term.get = getTerm;

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

	window.iLearner = iLearner;
}(window));
