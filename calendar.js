(function(window){
	var iLearner = window.iLearner || {},
		Calendar = {};

	window.iL = iLearner;
	iLearner.Calendar = Calendar;

	function getLessons(start, end, callback){
		var post_data = {
			sDate: iL.formatDate(start)
		};
		$.post(iL.API_ROOT + 'process_getCalendarData.php',
			post_data,
			function(data){
				var events = [];
				$.each(data.CalendarCourse, function(i,item){
					var start = new Date(item.ScheduleDate),
						end = new Date(item.ScheduleDate);
					start.setHours(item.Starttime.substr(0,2));
					start.setMinutes(item.Starttime.substr(2,2));
					end.setHours(item.endtime.substr(0,2));
					end.setMinutes(item.endtime.substr(2,2));
					events.push({
						title: item.Coursetitle,
						start: start,
						end: end
					});
				});
				callback(events);
			},
			"json");
	}
	Calendar.getLessons = getLessons;

}(window));
