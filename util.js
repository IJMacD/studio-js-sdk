iL.Util = iL.Util || {};

/**
 * Given an attendance record this will return true or false depending on
 * whether or not the student is expected to attend the lesson
 * 
 * @param {Attendance}
 * @return boolean
 */
iL.Util.isAttending = function (_) { return _.isMakeup || (_.startDate < _.lesson.start && !_.absent) }

/**
 * Given a lesson this function will return true or false depending on whether
 * or not there are any students due to attend and hence whether the lesson
 * is likely to go ahead.
 * 
 * @param {Lesson}
 * @return boolean
 */
iL.Util.hasAttendees = function (_) { return _.attendees.filter(iL.Util.isAttending).length > 0; }

/**
 * Given an attendance record this will return true or false depending on
 * whether or not this is a reservation
 * 
 * @param {Attendance}
 * @return boolean
 */
iL.Util.isReservation = function (_) { return _.startDate > _.lesson.start }

/**
 * Given an attendance record this will return true or false depending on
 * whether or not this is a reservation
 * 
 * @param {Attendance}
 * @return boolean
 */
iL.Util.isNotReservation = function (_) { return !iL.Util.isReservation(_) }
