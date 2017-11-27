import { Tutor, Term, query } from './core';
import { Course } from './calendar';
import { Student, Subscription } from './members';
import * as Util from './util';

const Conf = window['ilConf'];

export const Report = {};

let _reports = {},
		reports = {},
		learningObjectives = {},

		comments,

		learningDefaults = {wh1label: "Politeness", wh2label: "Attentiveness", wh3label: "Participation", wh4label: "Effort"},
		saveFields = "idmembercoursereportcard ap1label ap1value ap1progress ap2label ap2value ap2progress ap3label ap3value ap3progress ap4label ap4value ap4progress wh1label wh1value wh1progress wh2label wh2value wh2progress wh3label wh3value wh3progress wh4label wh4value wh4progress generalcomments suggestions learningfocus attendance lessoncount".split(" ");

/**
 * Class for dealing with report cards
 *
 * @class Report
 */

/**
 * Get a specific report by ID
 *
 * @method get
 * @param {number} id
 * @return {object}
 */
function getReport(id){
	return reports[id];
}
Report.get = getReport;

/**
 * Get an array of report card stubs
 *
 * @method find
 * @param {object} options  Object describing search parameters
 * @param {object} [options.tutor]  Only get reports for this tutor
 * @param {object} [options.term]  Only get reports for this tutor
 * @param {object} [options.student]  Only get reports for this student
 * @param {Date} [options.from] Reports for lessons which occur after this date
 * @param {Date} [options.to] Reports for lessons which occur before this date
 * @param {boolean} [options.clearCache] Do not fetch from the cache, instead hit server
 * @return {Promise} Returns a promise object which can be used to wait for results
 */
function find(options){
	var post_data = {},
		hash;

	options = options || {};

	if(!options.tutor || !options.term){
		// The server requires these! We can't search without them

		if(options.student){
			// We can't search the server but we can search our cache
			var result = [];
			for(const id in reports){
				if(reports[id].student.id == options.student.id){
					result.push(reports[id]);
				}
			}
			return Promise.resolve(result);
		}

		throw new Error("iL.Report.find(): tutor and term are required");
	}

	if(options.tutor){
		post_data.searchTutor = options.tutor.id || options.tutor;
	}

	if(options.from){
		post_data.searchDateFrom = Util.formatDate(options.from);
	}

	if(options.to){
		post_data.searchDateTo = Util.formatDate(options.to);
	}

	if(options.term){
		post_data.searchTerm = options.term.id;
	}

	hash = JSON.stringify(post_data);

	if(options.clearCache){
		_reports[hash] = undefined;
	}

	// If this particular query hasn't been run before start it now
	// with the exception that the query *must* specify a tutor and a term
	if(!_reports[hash] && post_data.searchTutor && post_data.searchTerm){
		_reports[hash] = query("process_getMemberReportCardList.php", post_data)
			.then(function(data){
				var resultSet = [];
				if(data.MemberReportCardList){
					data.MemberReportCardList.forEach(function (item, i){
						var studentID = item.memberID,
							courseID = item.courseID,
							subscriptionID = item.membercourseid,
							reportID = item.membercourseid,
							term = (post_data.searchTerm ? Term.get(post_data.searchTerm) : {}),
							tutor = Tutor.get(item.tutormemberID) || {},
							student = Student.add({
								id: studentID,
								name: item.nickname
							}),
							course = Course.add({
								id: courseID,
								title: item.coursename,
								startTime: item.starttime,
								endTime: item.endtime,
								day: dayNameToInt(item.dayname1),
								tutor: tutor,
								code: item.coursecode && item.coursecode.replace(/\<.*?\>/g, "")
							}),
							subscription = Subscription.add({
								id: subscriptionID,
								student: student,
								course: course
							}),
							report = addReport({
								id: reportID,
								student: student,
								course: course,
								subscription: subscription,
								complete: (item.completed == "1"),
								attendance: item.lessoncount - item.leavecount,
								lessoncount: item.lessoncount,
								term: term,
								startDate: new Date(item.startdate),
								endDate: new Date(item.enddate),
								tutor: tutor
							});

						report.startDate.setHours(item.starttime.substr(0,2));
						report.startDate.setMinutes(item.starttime.substr(2,2));

						if(report.endDate > Date.now()){
							report.endDate = undefined;
						}
						else {
							// Should be the time of the *start* of the last lesson
							report.endDate.setHours(item.starttime.substr(0,2));
							report.endDate.setMinutes(item.starttime.substr(2,2));
						}

						resultSet.push(report);
					});
				}
				return resultSet;
			});
	}

	return _reports[hash].then(function (reports) {
		if(options.student){
			return reports.filter(function (report) { return options.student.id == report.student.id });
		}

		return reports;
	});
}
Report.find = find;

/**
 * Add a report to be tracked by this module
 *
 * @method add
 * @param report {object} Object specifying initial properties
 * @return {object} The newly created object or original if it already existed
 */
function addReport(report) {

	// TODO: check if report already exists and don't replace it
	if(reports[report.id]){
		console.debug("About to replace report entry");
	}
	reports[report.id] = report;

	return report;
}
Report.add = addReport;

function dayNameToInt(name) {
	return "Sunday Monday Tuesday Wednesday Thursday Friday Saturday".split(" ").indexOf(name);
}

/**
 * Given a report stub this method provides the full report card details
 *
 * @method fetch
 * @param {object} item Report
 * @return {Promise} Returns a promise object which can be used to wait for results
 */
function fetchReport(item){
	var term = item.term || {};

	return Promise.all([
		query("process_getMemberReportCardDetail.php", { membercourseID: item.subscription.id, searchTerm: term.id }),
		getCourseLearningFocus(item.course)
	])
	.then(function(results){
		var a1 = results[0],
			focus = results[1],
			detail = a1.MemberReportCardDetail[0],
			labels = "ap1label ap2label ap3label ap4label wh1label wh2label wh3label wh4label ap1progress ap2progress ap3progress ap4progress ap1value ap2value ap3value ap4value wh1value wh2value wh3value wh4value wh1progress wh2progress wh3progress wh4progress".split(" "),
			o = {
				ap1progress: "0",
				ap2progress: "0",
				ap3progress: "0",
				ap4progress: "0",
				wh1progress: "0",
				wh2progress: "0",
				wh3progress: "0",
				wh4progress: "0",
				ap1value: "A+",
				ap2value: "A+",
				ap3value: "A+",
				ap4value: "A+",
				wh1value: "A+",
				wh2value: "A+",
				wh3value: "A+",
				wh4value: "A+"
			},
			i;

		o = Object.assign(o,
			// wh labels from code are lowest priority
			learningDefaults,
			// ap labels from second query are next priority
			focus
		);

		// labels already set in detail object are highest priority
		// but by default they are set as null which would overwrite our defaults
		for(i in labels) {
			if(!detail[labels[i]]){
				detail[labels[i]] = undefined;
			}
		}

		o = Object.assign(o, detail);

		o.tutor = Tutor.find(o.tutor);

		// There should be no conflict with labels when merging into report stub
		item = Object.assign(item, o);

		item.termfocus = item.learningfocusthisterm;
		item.learningfocusthisterm = undefined;

		isComplete(item);

		// Some house keeping:
		// Check to see if we can steal learning focii from this report if the
		// server didn't give us any
		if(!focus.ap1label && item.ap1label){
			setCourseLearningFocus(item.course, "ap1label", item.ap1label);
		}
		if(!focus.ap2label && item.ap2label){
			setCourseLearningFocus(item.course, "ap2label", item.ap2label);
		}
		if(!focus.ap3label && item.ap3label){
			setCourseLearningFocus(item.course, "ap3label", item.ap3label);
		}
		if(!focus.ap4label && item.ap4label){
			setCourseLearningFocus(item.course, "ap4label", item.ap4label);
		}

		return item;
	});
}
Report.fetch = fetchReport;

/**
 * When provided with a full report object this method will save the report
 * back to the server.
 *
 * @method save
 * @param item {object} Report
 * @return {Promise} can be used to wait for results
 */
function save(item){
	var post_data = {},
		i, k;

	isComplete(item);

	post_data.searchTerm = item.term && item.term.id;
	for(i in saveFields){
		k = saveFields[i];
		post_data[k] = item[k];
	}
	post_data.learningfocusthisterm = item.termfocus;
	return query("process_updateMemberReportCardDetail.php", post_data);
}
Report.save = save;

function isComplete(item) {
	// Additional check to see if report actually has been completed
	// now that we have enough to verify.
	try{
		item.complete =
			(
				item.generalcomments.length > 0
			&& item.suggestions.length > 0
			&& item.learningfocus.length > 0
			);
	}catch(e){
		item.complete = false;
	}

	return item.complete;
}

/**
 * Static method to get comment templates
 *
 * @method getComments
 * @static
 * @return {Promise} Promise of an array
 */
function getComments(){

	if(!comments){
		comments = query("comment.php")
			.then(function(data){
				var result = {
						comments: {},
						improvement: {},
						focus: []
					},

					commentRegex = /^var ([a-z]+)_comments/igm,
					improvementRegex = /^var ([a-z]+)_improvement/igm,

					focusRegex = /focus\.push\("([^"]+)"\)/g,

					name,
					regex,
					matches;

				function parseComments(list, regex){
					var match;
					while(match = regex.exec(data)){
						list.push(
							match[1]
								.replace("XXX",			"{ student.forename }")
								.replace(/\bshe\b/g,	"{ pronounSubject }")
								.replace(/\bShe\b/g,	"{ pronounSubjectCapitalize }")
								.replace(/\bherself\b/g,"{ pronounReflexive }")
								.replace(/\bher\b/g,	"{ pronounPossesive }")
								.replace(/\bHer\b/g,	"{ pronounPossesiveCapitalize }")
								.replace(/\bgirl\b/g,	"{ nounGender }")
								.replace(/\bhe\b/g,		"{ pronounSubject }")
								.replace(/\bHe\b/g,		"{ pronounSubjectCapitalize }")
								.replace(/\bhimself\b/g,"{ pronounReflexive }")
								.replace(/\bhis\b/g,	"{ pronounPossesive }")
								.replace(/\bHis\b/g,	"{ pronounPossesiveCapitalize }")
								.replace(/\bhim\b/g,	"{ pronounObject }")
								.replace(/\bboy\b/g,	"{ nounGender }")
						);
					}
				}

				let match;
				while(match = commentRegex.exec(data)){
					name = match[1];
					result.comments[name] = [];

					regex = new RegExp(name + '_comments\\.push\\("([^"]+)"\\)', 'gi');

					parseComments(result.comments[name], regex);
				}

				while(match = improvementRegex.exec(data)){
					name = match[1];
					result.improvement[name] = [];

					regex = new RegExp(name + '_improvement\\.push\\("([^"]+)"\\)', 'gi');

					parseComments(result.improvement[name], regex);
				}

				parseComments(result.focus, focusRegex)

				return result;
			});
	}
	return comments;
}
Report.getComments = getComments;

/**
 * Get Learning focuses for courses
 *
 * @method getCourseLearningFocus
 * @static
 * @param course {object} Course object
 * @return {Promise} Promise of an object containing four descriptions
 */
function getCourseLearningFocus(course){
	var deferred,
			key = course.title + " " + course.level;
	if(!learningObjectives[ key ]){
		const promise = query("process_getCourseLearningFocus.php", { coursename: course.title + " " + course.level })
			.then(function(data){
				var focus = data.CourseFocusObject[0],
					o = {};
				if(focus){
					o.ap1label = focus.ap1;
					o.ap2label = focus.ap2;
					o.ap3label = focus.ap3;
					o.ap4label = focus.ap4;
				}
				return o;
			});
		learningObjectives[ key ] = promise;
	}
	return learningObjectives[ key ];
}
Report.getCourseLearningFocus = getCourseLearningFocus;

/**
 * Set course learning objective for a course
 *
 * DOES NOT save back to server, only for current session
 *
 * @method setCourseLearningFocus
 * @static
 * @param courseName {string}
 * @param focus {string} Which of the four fields to set
 * @param objective {string} Actual text of the objective
 */
function setCourseLearningFocus(course, focus, objective){
	getCourseLearningFocus(course)
		.then(function(focii){
			focii[focus] = objective;
		});
}
Report.setCourseLearningFocus = setCourseLearningFocus;

/**
 * Prepare reports for download as an Excel (.xlsx) file and return url to
 * download it.
 *
 * @method export
 * @static
 * @param tutor {object}
 * @param term {object}
 * @return {Promise<string>} Url where spreadsheet can be found
 */
function exportReports(options) {
	return query("process_ExportReportCard.php", {
		searchTutor: options.tutor.id,
		searchTerm: options.term.id,
		searchDateFrom: 0,
		searchDateTo: 0,
		G1:0,
		G2:0,
		G3:0,
		G4:0,
		G5:0,
		G6:0,
		G7:0,
		G8:0,
		G9:0,
		G10:0,
		G11:0,
		G12:0
	}).then(function(){ return ""; }, function () {
		// query expects results to be JSON. This response is not JSON
		// but we don't acctually care about the data. We just need to know
		// when it finishes; so we attach to the catch handler.
		return Conf.API_ROOT + "tmpexcel.xlsx";
	});
}
Report.export = exportReports;

