import { Tutor, query } from './core';
import { Course, Lesson, Attendance } from './calendar';
import * as Util from './util';

const Conf = window['ilConf'];

export const Student = {},
		Invoice = {},
		Subscription = {};

/* Constants */
const existingRegex = /\b\n?(Existing|New) Student\b/gi,
		existingOldRegex = /\b(old|existing)\b/gi,
		existingNewRegex = /\b(new)\b/gi,
		dayNumberArray = "SUN MON TUE WED THU FRI SAT".split(" "),

/* Parameters */
		existingCutoff = new Date(2014, 0, 1);

/* data */
let students = {},
		subscriptions = {},
		_students = {},
		_searches = {};

/**
 * Student class for dealing with students
 *
 * @class Student
 */

/**
 * Get a student specified by his ID
 *
 * @method get
 * @param {number} id Student ID
 * @return {object} Object representing the student
 */
function getStudent(id){
	return students[id];
}
Student.get = getStudent;

function resolveStudent(student){
	return students[student.id] || student;
}

/**
 * Add a student here for tracking which may have been generated elsewhere
 * (single homogenous module solves this)
 *
 * @method add
 * @param student {object} Student object
 */
function addStudent(student){
	var existing = resolveStudent(student) || {};

	// TODO: Re-implement
	// if(existing != student){
	// 		$.extend(existing, student);
	// }

	students[student.id] = existing;

	Util.parseName(existing);

	return existing;
}
Student.add = addStudent;

/**
 * Find students with specific conditions
 *
 * @method find
 * @param {object} options A map of options
 * @param {string} [options.name] Only return students whose name *contains* this value
 * @param {string} [options.phone] Only return students whose phone *contains* this value
 * @param {string} [options.school] Only return students whose school *contains* this value
 * @param {string} [options.year] Only return students who have lessons this year
 * @param {string} [options.month] Only return students who have lessons this month
 * @param {boolean} [options.clearCache] Only return students who have lessons this year
 * @return {Promise} Promise of an array of student objects
 */
function findStudents(options){
	var now = new Date(),
		post_data = {
			// Case-insensitive searching
			searchStudentName: options.name || "",
			searchStudentMobile: options.phone || "",
			searchStudentSchool: options.school || "",
			searchStudentCourseYear: options.year === undefined ? now.getFullYear() : options.year,
			searchStudentCourseMonth: options.month === undefined ? (now.getMonth() + 1) : options.month
		},
		hash = JSON.stringify(post_data);

	if(options.clearCache){
		_searches[hash] = undefined;
	};

	if(!_searches[hash]){
		_searches[hash] = query("process_getMemberList.php", post_data)
			.then(function(data){
				var out = [];

				data.memberlist.forEach(function(item){
					var name = (item.Lastname && item.nickname) ?
												(item.Lastname.length > item.nickname.length ?
														item.Lastname : item.nickname
												) : (item.Lastname || item.nickname),
							registeredDate = new Date(item.RegDate),
							student = addStudent({
								id: item.memberID,
								name: name.trim(),
								nameZH: item.chiname,
								gender: item.Gender == "1" ? "male" : "female",
								grade: item.Grade,
								account: item.AccountName,
								photo: Conf.PHOTO_URL + item.AccountName + ".jpg",
								school: item.School,
								phone: item.mobile,
								registeredDate: registeredDate,
								existing: registeredDate < existingCutoff
							});

					out.push(student);
				});

				return out;
			});
	}

	return _searches[hash];
}
Student.find = findStudents;

/**
 * Fetch details about a student
 *
 * @method fetch
 * @param student {object}
 * @return {object} The same student object passed in
 */
function fetchStudent(student){
	student = resolveStudent(student);
	if(!_students[student.id]){
		_students[student.id] = query("process_getMemberDetail.php", {memberID: student.id})
			.then(function(data){
				var guardians = [],
					guardian,
					subs = [];
				if(data.memberdetail){
					data.memberdetail.forEach(function(item){
						var name = (item.lastname && item.Nickname) ?
							(item.lastname.length > item.Nickname.length ? item.lastname : item.Nickname) :
							(item.lastname || item.Nickname);
						name = name.trim();
						if(item.isStudent == "1"){
							student.name = name;
							student.nameZH = item.Chiname;
							student.gender = item.Gender == "1" ? "male" : "female";
							student.grade = item.Grade;
							student.account = item.AccountName;
							student.photo = Conf.PHOTO_URL + item.AccountName + ".jpg";
							student.school = item.School;
							student.phone = item.Mobile;
							student.notes = item.Remarks;
							student.notesPayment = item.RemarkAboutPayment;
							student.birthDate = new Date(item.BirthYear, item.BirthMonth - 1, item.BirthDay);
							student.registeredDate = new Date(item.RegDate);

							if(student.notes.match(existingOldRegex) || student.notesPayment.match(existingOldRegex)){
								student.existing = true;
							}
							else if(student.notes.match(existingNewRegex) || student.notesPayment.match(existingNewRegex)){
								student.existing = false;
							}
							else if (student.registeredDate < existingCutoff){
								student.existing = true;
							}
							else {
								student.existing = !!student.existing;
							}

							/* Not currently used but need to
									look after them in order to
									be able to save */
							student.schoolStart = item.schooltimefrom;
							student.schoolEnd = item.schooltimeto;
							student.soco = item.isSOCO == "1";
							student.entryChannel1 = item.whyjoinusextendtext1;
							student.entryChannel2 = item.whyjoinusextendtext2;
							student.isSuspended = item.suspend;

							student.guardians = guardians;

							// The student should definetly already be being tracked at this
							// point but no harm adding again for safety here right?
							addStudent(student);

							// break loop
							return false;
						}
						else if(item.isGuardian == "1"){
							guardian = {
								accountID: item.AccountName,
								relationship: item.Relationship,
								name: item.lastname,
								nameZH: item.Chiname,
								nickname: item.Nickname,
								email: item.emailaddress,
								address: item.Address,
								occupation: item.Occupation,
								phone: item.Mobile,
								phoneHome: item.HomeNo,
								phoneOffice: item.OfficeNo
							};
							guardians.push(guardian);
						}
					});
				}
				if(data.memberCourseBalance){
					data.memberCourseBalance.forEach(function(item){
						var courseID = item.CourseID,
							subscriptionID = item.membercourseID,
							lessonCount = parseInt(item.Nooflesson),
							fullPrice = parseInt(item.shouldpaid),
							pricePerLesson = fullPrice / lessonCount,
							dateIndex,
							dayNumber = dayNumberArray.indexOf(item.ts.substring(0, 3)),
							startTime = item.ts.substring(4, 8),
							endTime = item.ts.substring(12, 16),
							course = Course.add({
								id: courseID,
								title: item.Coursename,
								code: item.CourseCode,
								/* This is the potential discount for existing students,
										on this subscription.
										The student is *not* necessarily entitled to this */
								existingDiscount: parseInt(item.DiscountForOldStudent),
								pricePerLesson: pricePerLesson,
								tutor: Tutor.find(item.tutorname),
								day: dayNumber,
								startTime: startTime,
								endTime: endTime
							}),
							subscription = Subscription.add({
								id: subscriptionID,
								course: course,
								student: student,
								withdrawn: item.withdrawal == "1"
							}),

							/*
								- Discount, Amount, AmountAfterDiscount are for *PAID* invoices
								- shouldpaid is full price for future lesson
							*/
							discount = parseInt(item.Discount) || 0,
							originalAmount = parseInt(item.Amount) || fullPrice,
							finalAmount = parseInt(item.AmountAfterDiscount) || originalAmount - discount,
							invoice = {
								id: item.MemberCourseInvoiceID,
								year: parseInt(item.invoiceyear),
								month: parseInt(item.invoicemonth),
								lessonCount: lessonCount,
								paid: item.Paid == "1",
								amount: finalAmount,
								originalAmount: originalAmount,
								discount: originalAmount - finalAmount,
								handledBy: item.handleby,
								memberID: item.memberID,
								memberCourseID: item.membercourseID
							};

						dateIndex = invoice.year * 100 + invoice.month;

						if(!subscription.invoices){
							subscription.invoices = [];
						}

						subscription.invoices.push(invoice);

						if(!invoice.paid){
							subscription.unpaid += 1;

							if(!invoice.overdue && !invoice.dueNow){
								subscription.isActive = true;
							}
						}

						if(subs.indexOf(subscription) == -1){
							subs.push(subscription);
						}
					});

					student.subscriptions = subs;
				}
				return student;
			});
	}
	return _students[student.id];
}
Student.fetch = fetchStudent;

/**
 * Save student back to the server
 *
 * @method save
 * @param {object} student
 * @return {Promise} Prmoise of a Student resolves when server confirms student has been saved succesfully
 */
function saveStudent(student){
	if(!student.guardians || !student.guardians.length){
		student.guardians = [{}];
	}

	student.notes = student.notes.replace(existingRegex, "");

	if(student.existing){
		student.notes = student.notes.replace(existingNewRegex, "").trim();
		student.notes += student.notes.length ? "\n" : "";
		student.notes += "Existing Student";
	}else{
		student.notes = student.notes.replace(existingOldRegex, "").trim();
		student.notes += student.notes.length ? "\n" : "";
		student.notes += "New Student";
	}

	var guardian = student.guardians[0],
		post_data = {
			Action: student.id ? "update" : "insert",
			MemberID: student.id,
			MemberDetailNameinEnglish: student.name,
			MemberDetailRemark: student.notes,
			MemberDetailRemarkPayment: student.notesPayment,
			MemberDetailNameinChinese: student.nameZH,
			MemberDetailNickname: student.englishName,
			MemberDetailBirthDay: Util.formatDate(student.birthdate),
			MemberDetailGender: student.gender == "male" ? "1" : "0",
			MemberDetailGrade: student.grade,
			MemberDetailSchool: student.school,
			MemberDetailSchooltimefrom: student.schoolStart,
			MemberDetailSchooltimeto: student.schoolEnd,
			isSOCO: student.soco ? 1 : 0,
			GuardianDetailMemberID: guardian.accountID,
			GuardianDetailRelationship: guardian.relationship,
			GuardianDetailNameinEnglish: guardian.name,
			GuardianDetailNameinChinese: guardian.nameZH,
			GuardianDetailNickname: guardian.nickname,
			GuardianDetailEmail: guardian.email,
			GuardianDetailAddress: guardian.address,
			GuardianDetailOccupation: guardian.occupation,
			GuardianDetailHomeNo: guardian.phoneHome,
			/* Be careful! At the moment `student.phone` is echoed back for both the
					student and guardian but it is only saved under the guardian. We
					keep track of it as part of the student for simplicity, which is
					why we're using that value here - just incase it has been modified
					on the student */
			GuardianDetailMobileNo: student.phone,
			GuardianDetailOfficeNo: guardian.phoneOffice,
			whyjoinusextendtext1: student.entryChannel1,
			whyjoinusextendtext2: student.entryChannel2,
			suspend: student.isSuspended,
			MemberReturnYear: 0,
			MemberReturnMonth:0,
			MemberReturnDay:0
		};

	return query("process_updateMemberInformation.php", post_data)
	.then(function(data){
		if(!data || data.statuscode != "1"){
			return Promise.reject(Error("Server Rejected Student"));
		}
		if(!student.id){
			student.id = data.MemberID;
			student.accountID = data.SAccount;
			student.guardians[0].accountID = data.GAccount;
			student.registeredDate = new Date();
			addStudent(student);
		}
		return student;
	});
}
Student.save = saveStudent;


/**
 * Invoice class for dealing with invoices
 *
 * @class Invoice
 */

/**
 * Function to commit invoices to the server
 *
 * @method save
 * @param invoice {object}
 */
function saveInvoice(invoice){
	var post_data = {
			MemberCourseID: invoice.memberCourseID,
			InvoiceYear: invoice.year,
			InvoiceMonth: invoice.month,
			shouldpay: invoice.originalAmount,
			AmountAfterDiscount: invoice.amount,
			paymentmethod: invoice.paymentMethod == "cash" ? 1 : 2,
			ChequeNo: invoice.chequeNumber,
			CouponCode: invoice.coupons.join(","),
			issuedate: invoice.date,
			htmlselect_Discountvalue_val: invoice.originalAmount - invoice.amount,
			htmlselect_Discounttype_val: 1	// dollars
		};
	return query("process_updateMemberInvoice.php", post_data)
	.then(function(data){
		invoice.id = data.iID;
		invoice.handledBy = data.handle;
		invoice.paid = true;
	});
}
Invoice.save = saveInvoice;

/**
 * Void an Invoice
 *
 * [Sugar] for...
 *
 * @method void
 * @param invoice {object}
 * @param reason {string}
 * @return {Promise} Promise reflects success of operation
 */
function voidInvoice(invoice, reason){
	var post_data = {
			membercourseinvoiceID: invoice.id,
			reason: reason
		};
	return query("process_removeMemberInvoice.php", post_data)
	.then(function(data){
		invoice.id = 0;
		invoice.handledBy = undefined;
		invoice.paid = false;
	});
}
Invoice.voidInvoice = voidInvoice;

/**
 * Class to handle Student-Course Links
 *
 * @class Subscription
 */

/**
 * Get Subscription by id (memberCourseID)
 *
 * @method get
 * @param id {number}
 * @return {object}
 */
function getSubscription(id){
	return subscriptions[id];
}
Subscription.get = getSubscription;

/**
 * Find Subscription by course and student
 *
 * @method get
 * @param options {object}
 * @param options.course {object}
 * @param options.student {object}
 * @return {Promise(Subscription[])}
 */
function findSubscription(options){
	var out = [];
	Object.keys(subscriptions).forEach(function(key){
		var subscription = subscriptions[key];
		if(subscription.course == options.course &&
			subscription.student == options.student){
			out.push(subscription);
		}
	});
	return Promise.resolve(out);
}
Subscription.find = findSubscription;

/**
 * Start tracking a subscription
 *
 * @method add
 * @param subscription {object}
 */
function addSubscription(subscription){
	var existing = subscriptions[subscription.id] || {
				/** Defaults **/
				unpaid: 0,
				lastPaymentIndex: 0,
				invoices: [],
				isActive: false
			};

			extend(existing, subscription);

	subscriptions[subscription.id] = existing;

	return existing;
}
Subscription.add = addSubscription;

function extend(obj, props) {
		for(var prop in props) {
				if(props.hasOwnProperty(prop)) {
						obj[prop] = props[prop];
				}
		}
}
/**
 * Save a subscription to the server
 *
 * Subscribe/Unsubscribe a student to/from a course
 *
 * @method save
 * @param subscription {object}
 * @return {Promise(Subscription)}
 */
function saveSubscription(subscription){
	var post_data;
	if(subscription.lastLesson){
		post_data = {
			membercourseID: subscription.id,
			courseScheduleID: subscription.lastLesson.id
		};
		return query("process_MemberCourseWithDrawal.php", post_data)
		.then(function(){
			// invalidate attendances
			Lesson
				.future(subscription.lastLesson)
				.then(function(lessons){
					lessons.forEach(function(lesson){
						Attendance.find({lesson: lesson, clearCache: true});
					});
				});
		});
	}
	else {
		post_data = {
			Action: subscription.id ? "update" : "insert",
			MemberID: subscription.student.id,
			CoruseScheduleID: subscription.firstLesson.id, // [sic]
			StudentCourseRegistrationDate: Util.formatDate(new Date()),
			StudentCoursePaymentcycle: 2 // [sic] per lesson
		};
		return query("process_updateMemberCourse.php", post_data)
		.then(function(data){
			if(!subscription.id){
				subscription.id = data.MemberCourseID;
				addSubscription(subscription);

				// invalidate attendances
				Lesson
					.future(subscription.firstLesson)
					.then(function(lessons){
						lessons.forEach(function(lesson){
							Attendance.find({lesson: lesson, clearCache: true});
						});
					});
			}
			return subscription;
		});
	}
}
Subscription.save = saveSubscription;

/**
 * Cancel a student subscription to a course
 *
 * @method remove
 * @param subscription {object}
 * @return {Promise}
 */
function removeSubscription(subscription){
	return query("process_cancelMemberCourse.php", {MemberCourseID: subscription.id})
	.then(function(){
		// invalidate attendancess
	});
}
Subscription.remove = removeSubscription;
