(function(window){
	var iLearner = window.iLearner || {},
		Calendar = {},

		levelRegex = /\s*\w\d(?:\s?-\s?\w\d)?\s*/i,
		customLevels = [
			{regex: /Trinity/, level: "K"},
			{regex: /GCSE/, level: "S"},
			{regex: /St\. Mary/, level: "P"}
		];

	window.iL = iLearner;
	iLearner.Calendar = Calendar;

	function getLessons(start, end){
		var post_data = {
				sDate: iL.formatDate(start)
			},
			deferred = $.Deferred();
		$.post(iL.API_ROOT + 'process_getCalendarData.php',
			post_data,
			function(data){
				var events = [];
				$.each(data.CalendarCourse, function(i,item){
					var start = new Date(item.ScheduleDate),
						end = new Date(item.ScheduleDate),
						tutor = iL.findTutor(item.Tutor, true),
						level = item.Coursetitle.match(levelRegex),
						course = item.Coursetitle.replace(levelRegex, "");
					start.setHours(item.Starttime.substr(0,2));
					start.setMinutes(item.Starttime.substr(2,2));
					end.setHours(item.endtime.substr(0,2));
					end.setMinutes(item.endtime.substr(2,2));
					level = level && level[0].replace(" ", "");
					if(!level){
						$.each(customLevels, function(i,cItem){
							if(cItem.regex.test(course)){
								level = cItem.level;
								return false;
							}
						});
					}
					events.push({
						title: item.Coursetitle,
						start: start,
						end: end,
						tutor: tutor,
						room: item.Location,
						course: course,
						level: level
					});
				});
				deferred.resolve(events);
			},
			"json");
		return deferred.promise();
	}
	Calendar.getLessons = getLessons;

}(window));
