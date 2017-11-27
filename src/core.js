import SparkMD5 from 'spark-md5';

import Util from './util';

import * as DefaultConf from './conf';

const	defaults = {
	API_ROOT: "/",
	PHOTO_URL: "/photos"
};

const Conf = { ...DefaultConf, ...defaults, ...window['ilConf'] };
window['ilConf'] = Conf;

export const Tutor = {};
export const User = {};
export const Room = {};
export const Term = {};

let adminStaff,
		users,
		classrooms,
		tutors,
		terms,
		coursePrices;

let	currentUser = null,

		loading,
		_checkLogin;

export function login(user, pass){
	return query("process_login.php", { login: user, password: pass })
		.then(function (data){
			if(data.result && data.result[0]){
				const memberID = parseInt(data.result[0].mid);
				const accountName = data.result[0].acc;

				currentUser = {
					id: memberID,
					username: accountName,
					name: data.result[0].currentusernickname || accountName,
					colour: null,
				};

				currentUser.colour = getTutorColour(currentUser);

				if(!memberID){
					throw Error("No member ID");
				}

				return currentUser;
			}
			else{
				throw Error("Invalid data from the server");
			}
		});
}

export function logout(){
	query("process_logout.php", null, "text");
	currentUser = null;
}

export function getInitData(){
	loading = query("process_getinitdata.php")
		.then(function(data){
			adminStaff = {};
			users = {};
			data.AdminStaff.forEach(function (staff) {
				var obj = {
					id: staff.MemberID,
					name: staff.User
				};
				obj.colour = getTutorColour(obj);
				adminStaff[obj.id] = obj;
				users[obj.id] = obj;
			});

			classrooms = data.classroom.map(function(i){
				return { id: i.crid, name: i.place, centre: parseInt(i.centreID) }
			});

			if(data.term && data.term.map){
				terms = data.term.map(function(term){
					return {
						id: term.idStudioTerms,
						year: term.TermYear,
						name: term.Term,
						start: new Date(term.Startdate),
						end: new Date(term.Enddate)
					}
				});
			}
			else {
				terms = [];
			}

			tutors = data.tutor.map(function(t){
				var tutor = { name: t.n.trim(), id: t.mid };
				tutor.colour = getTutorColour(tutor);
				users[tutor.id] = tutor;
				return tutor;
			});

			// Sort through the raw data so that the calendar module can
			// use it more easily later.
			coursePrices = {};
			data.courseprice.forEach(function(course){
				var pricePerLesson = parseInt(course.priceperlesson),
						discountOldStudent = parseInt(course.priceperlesson_oldstudent);
				coursePrices[course.course] = {
					pricePerLesson: pricePerLesson,
					pricePerLessonOldStudent: pricePerLesson - discountOldStudent,
					discountOldStudent: discountOldStudent
				};
			});
		});

	// Check if we're already logged in.
	checkLogin().then(function (user) {
		currentUser = user;
		user.colour = getTutorColour(user);
	})

}

export function checkLogin() {
	if(!_checkLogin){
		_checkLogin = Promise.all([
			Tutor.all(),
			query("index.php", null, "text").then(function (data) {
				var match = data.match(/mid = "(\d+)"/);
				if(match){
					return match[1];
				}
				return Promise.reject("Not logged in");
			})
		]).then(function (results) {
			// So that we can fetch fresh results later
			// We only want one pending request at a time
			_checkLogin = null;

			var tutors = results[0],
					id = results[1],
					user = Tutor.get(id);

			if(!user){
				user = adminStaff[id];
			}

			if(user){
				return {
					id: user.id,
					username: user.name,
					name: user.name
				};
			}

			return {
				id: id,
				username: "user" + id,
				name: "User " + id
			};
		});
	}
	return _checkLogin;
}
// iLearner.checkLogin = checkLogin;

export function getCurrentUser(){
	return currentUser;
}

export function getCurrentTutor(){
	return currentUser && getTutors(currentUser.id);
}

/**
 * Undocumented internal function
 */
export function getCoursePrices(){
	return coursePrices;
}

export function query(url, data, type){
	if(!type) type = "json";

	var formData = [];
	if(data){
		Object.keys(data).forEach(function (key) {
			formData.push(key + "=" + encodeURIComponent(data[key]));
		});
	}

	return new Promise(function(resolve, reject){
		fetch(Conf.API_ROOT + url, {
				method: 'post',
				body: formData.join("&"),
				headers: new Headers({
					"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
				}),
				credentials: 'include'
			})
			.then(function (result){
				resolve(type == "json" ? result.json() : result.text());
			}, function(error){
				console.error(error);
				reject(error);
			});
	});
}

/**
 * Used for interacting with users
 *
 * @class User
 */

/**
 * Get a single user specified by his ID
 *
 * @method get
 * @param {number} id ID of the user you with to fetch
 * @return {object} Object containing the details of the user
 */
function getUser(id){
	return users[id];
}
User.get = getUser;

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
 * @param {number} id ID of the tutor you with to fetch
 * @return {object} Object containing the details of the tutor
 */
function getTutors(id){
	var tutor;
	if(tutors && id){
		tutors.forEach(function(t){
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
 * @param {string} name Name of the tutor you with to fetch
 * @param {boolean} fallback If true will return a constructed object
 * even if a corresponding one	was not found on the server
 * @return {object} Object containing the details of the tutor
 */
function findTutor(name, fallback){
	var tutor;

	if(!name){
		return { name: "", colour: "#999999" };
	}

	name = name.trim();

	if(tutors){
		tutors.forEach(function(t){
			if(t.name == name){
				tutor = t;
				return false;
			}
		});
	}

	if(!tutor && fallback){
		tutor = { name: name, colour: null };
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
 * @param {object} tutor
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
	* @param {number} id ID of the Room to get
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
		classrooms.forEach(function(c){
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
 * @param {string} name
 * @return {object} Object describing room
 */
function findRoom(name){
	var classroom;

	if(!name){
		return { id: 0, name: "" };
	}

	if(classrooms){
		classrooms.forEach(function(c){
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
 * @param {object} options map of options
 * @return {Promise} Promise of an array of terms
 */
function findTerm(options){
	if(!options){
		throw new Error("No options specified for finding a term");
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

		throw new Error("No options specified for finding a term")
	});
}
Term.find = findTerm;

/**
 * Get a term based on id
 *
 * @method find
 * @param {number} ID
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
