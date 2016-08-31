iL.Util = iL.Util || {};

iL.Util.isAttending = function (_) { return _.isMakeup || (_.startDate < _.lesson.start && !_.absent) }

iL.Util.hasAttendees = function (_) { return _.attendees.filter(iL.Util.isAttending).length > 0; }