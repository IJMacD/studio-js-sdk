iL.Util = iL.Util || {};

iL.Util.isAttending = function (_) { return _.isMakeup || (_.startDate < _.lesson.start && !_.absent) }

iL.Util.hasAttendees = function (_) { return _.attendees.filter(isAttending).length > 0; }