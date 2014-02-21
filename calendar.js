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
						end = new Date(item.ScheduleDate),
						tutor = iL.findTutor(item.Tutor),
						textColour = (tutor && (colourLightness(tutor.colour) < 128)) ? "#fff" : "#333";
					start.setHours(item.Starttime.substr(0,2));
					start.setMinutes(item.Starttime.substr(2,2));
					end.setHours(item.endtime.substr(0,2));
					end.setMinutes(item.endtime.substr(2,2));
					events.push({
						title: item.Coursetitle,
						start: start,
						end: end,
						color: tutor && tutor.colour,
						tutor: item.Tutor,
						resourceId: item.Location,
						textColor: textColour
					});
				});
				callback(events);
			},
			"json");
	}
	Calendar.getLessons = getLessons;

	function colourLightness(hex){
		var c = hex.substring(1),      // strip #
			rgb = parseInt(c, 16),   // convert rrggbb to decimal
			r = (rgb >> 16) & 0xff,  // extract red
			g = (rgb >>  8) & 0xff,  // extract green
			b = (rgb >>  0) & 0xff;  // extract blue

		return (0.2126 * r + 0.7152 * g + 0.0722 * b); // per ITU-R BT.709
	}

}(window));
