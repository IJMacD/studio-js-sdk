const topNames = "Chan Chau Chang Cheng Cheung Chin Ching Chiu Choi Chow Chu Chui Chun Chung Fan Fong Foo Fu Fung"
              + " Ha Hau Heung Ho Hon Hong Hooi Hui Hung Ka Kam Keung Kiu Ko Kok Kong Ku Kung Kwok Lai Lam Lau Lay"
              + " Lee Leung Li Liu Lo Loong Lui Luk Lung Ma Mak Man Mang Mo Mok Ng Ngai Ngan Pak Pang Poon Sek Shek Sheung"
              + " Shiu Sit Siu So Suen Sum Sung Sze Tai Tam Tang Tin Ting To Tong Tong Tou Tsang Tse Tseung Tso Tsoi Tsui"
              + " Tuen Tung Wai Wan Wong Wong Wu Yam Yan Yau Yeung Yim Yip Yiu Yu Yue Yuen".split(" ");

/**
 * Given an attendance record this will return true or false depending on
 * whether or not the student is expected to attend the lesson
 *
 * @param {object} _ Attendance
 * @return boolean
 */
export const isAttending = function (_) { return _.isMakeup || (_.startDate < _.lesson.start && !_.absent) }

/**
 * Given a lesson this function will return true or false depending on whether
 * or not there are any students due to attend and hence whether the lesson
 * is likely to go ahead.
 *
 * @param {object} _ Lesson
 * @return boolean
 */
export const hasAttendees = function (_) { return _.attendees.filter(isAttending).length > 0; }

/**
 * Given an attendance record this will return true or false depending on
 * whether or not this is a reservation
 *
 * @param {object} _ Attendance
 * @return boolean
 */
export const isReservation = function (_) { return _.startDate > _.lesson.start }

/**
 * Given an attendance record this will return true or false depending on
 * whether or not this is a reservation
 *
 * @param {object} _ Attendance object
 * @return boolean
 */
export const isNotReservation = function (_) { return !isReservation(_) }

/**
 * Format date in server specific format
 *
 * @method formatDate
 * @static
 * @param {Date|Moment} date Javascript Date or Moment object representing the date to format
 * @return {string} Date in format `YYYY/m/d`
 */
export function formatDate(date){
	date = date.toDate ? date.toDate() : date;
	return date.getFullYear() + "/" + (date.getMonth() + 1) + "/" + date.getDate();
}

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
 * @param {object} person Object with a `name` property
 */
export function parseName (person) {
	person.name = person.name.trim();

	var names = person.name.match(/\w+/g);

	if(!names){
		return;
	}
	else if(names.length == 1){
		// Not a lot else we can do
		person.forename = names[0];
		person.surname = "";
		person.englishName = names[0];
		person.chineseName = names[0];

	}
	else if(names.length == 2){
		// Assume just English name and surname

		person.forename = names[0];
		person.surname = names[1];
		person.englishName = names[0] + " " + names[1];
		person.chineseName = person.englishName;
	}
	else if(person.name.indexOf(",") > -1){
		// Name provided with English name at end (with a comma)
		// Could be 2, 3+ chinese names etc.

		person.forename = person.name.substr(person.name.indexOf(",")+1).trim();
		person.surname = names[0];
		person.englishName = person.forename + " " + person.surname;
		person.chineseName = person.name.substr(0,person.name.indexOf(",")).trim();
	}
	else if(names.length == 3){
		// Assume no English name

		person.forename = names[1] + " " + names[2];
		person.surname = names[0];
		person.chineseName = names[0] + " " + names[1] + " " + names[2];
		person.englishName = person.chineseName;
	}
	else if(topNames.indexOf(names[0]) > -1){
		// Name provided with English name at end (without a comma)

		person.forename = names[names.length - 1];
		person.surname = names[0];
		person.englishName = person.forename + " " + person.surname;
		person.chineseName = names.slice(0, names.length - 1).join(" ");
	}
	else {
		// Name provided with English name at start

		person.forename = names[0];
		person.surname = names[1];
		person.englishName = person.forename + " " + person.surname;
		person.chineseName = names[1] + " " + names[2] + " " + names[3];
	}
}
