(function(window){

	/**
	 * Members module. Contains Student class.
	 *
	 * @module Members
	 */
	var iLearner = window.iLearner || {},
		Student = {},
		Invoice = {},
		Subscription = {},

		/* Constants */
		existingRegex = /\b\n?(Existing|New) Student\b/gi,
		existingOldRegex = /\b(old|existing)\b/gi,
		existingNewRegex = /\b(new)\b/gi,

		/* Parameters */
		existingCutoff = moment([2014]),

		/* data */
		students = {},
		subscriptions = {},
		_students = {},
		_searches = {};

	window.iL = iLearner;
	iLearner.Student = Student;
	iLearner.Subscription = Subscription;
	iLearner.Invoice = Invoice;

	/**
	 * Student class for dealing with students
	 *
	 * @class Student
	 */

	/**
	 * Get a student specified by his ID
	 *
	 * @method get
	 * @param id {int} Student ID
	 * @return {object} Object representing the student
	 */
	function getStudent(id){
		return students[id];
	}
	Student.get = getStudent;

	/**
	 * Add a student here for tracking which may have been generated elsewhere
	 * (single homogenous module solves this)
	 *
	 * @method add
	 * @param student {object} Student object
	 */
	function addStudent(student){
		students[student.id] = student;
	}
	Student.add = addStudent;

	/**
	 * Find students with specific conditions
	 *
	 * @method find
	 * @param options {object} A map of options
	 * @param [options.name] {string} Only return students whose name *contains* this value
	 * @return {Promise} Promise of an array of student objects
	 */
	function findStudents(options){
		var now = new Date(),
			post_data = {
				// Case-insensitive searching
				searchStudentName: options.name && options.name.toLowerCase(),
				searchStudentMobile: options.phone,
				searchStudentSchool: options.school,
				searchStudentCourseYear: options.year === undefined ? now.getFullYear() : options.year,
				searchStudentCourseMonth: options.month === undefined ? (now.getMonth() + 1) : options.month
			},
			hash = JSON.stringify(post_data);

		if(options.clearCache){
			_searches[hash] = undefined;
		};

		if(!_searches[hash]){
			_searches[hash] = Promise.resolve(
					$.post(iL.API_ROOT + "process_getMemberList.php", post_data, null, "json")
				)
				.then(function(data){
					var out = [];
					data.memberlist.forEach(function(item){
						var id = item.memberID,
							student = students[id] || {
								id: id
							},
							name = (item.Lastname && item.nickname) ?
								(item.Lastname.length > item.nickname.length ? item.Lastname : item.nickname) :
								(item.Lastname || item.nickname);

						name = $.trim(name);
						student.name = name;
						student.gender = item.Gender == "1" ? "male" : "female";
						student.grade = item.Grade;
						student.account = item.AccountName;
						student.photo = iL.Conf.PHOTO_URL + item.AccountName + ".jpg";
						student.school = item.School;
						student.phone = item.mobile;
						student.registeredDate = new Date(item.RegDate);

						student.existing = student.registeredDate < existingCutoff;

						iL.Util.parseName(student);

						students[id] = student;
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
		student = students[student.id] || student;
		if(!_students[student.id]){
			_students[student.id] = Promise.resolve(
					$.post(iL.API_ROOT + "process_getMemberDetail.php", {memberID: student.id}, null, "json")
				).then(function(data){
					var guardians = [],
						guardian,
						subs = [];
					if(data.memberdetail){
						$.each(data.memberdetail, function(i,item){
							var name = (item.lastname && item.Nickname) ?
								(item.lastname.length > item.Nickname.length ? item.lastname : item.Nickname) :
								(item.lastname || item.Nickname);
							name = $.trim(name);
							if(item.isStudent == "1"){
								student.name = name;
								student.gender = item.Gender == "1" ? "male" : "female";
								student.grade = item.Grade;
								student.account = item.AccountName;
								student.photo = iL.Conf.PHOTO_URL + item.AccountName + ".jpg";
								student.school = item.School;
								student.phone = item.Mobile;
								student.notes = item.Remarks;
								student.birthDate = new Date(item.BirthYear, item.BirthMonth - 1, item.BirthDay);

								if(student.notes.match(existingOldRegex)){
									student.existing = true;
								}
								else if(student.notes.match(existingNewRegex)){
									student.existing = false;
								}
								else {
									student.existing = !!student.existing;
								}

								/* Not currently used but need to
								   look after them in order to
								   be able to save */
								student.notesPayment = item.RemarkAboutPayment;
								student.nameChinese = item.Chiname;
								student.schoolStart = item.schooltimefrom;
								student.schoolEnd = item.schooltimeto;
								student.soco = item.isSOCO == "1";
								student.entryChannel1 = item.whyjoinusextendtext1;
								student.entryChannel2 = item.whyjoinusextendtext2;

								iL.Util.parseName(student);

								student.guardians = guardians;

								students[student.id] = student;

								// break loop
								return false;
							}
							else if(item.isGuardian == "1"){
								guardian = {
									accountID: item.AccountName,
									relationship: item.Relationship,
									name: item.lastname,
									nameChinese: item.Chiname,
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
						$.each(data.memberCourseBalance, function(i,item){
							var courseID = item.CourseID,
								subscriptionID = item.membercourseID,
								lessonCount = parseInt(item.Nooflesson),
								fullPrice = parseInt(item.shouldpaid),
								pricePerLesson = fullPrice / lessonCount,
								dateIndex,
								course = iL.Course.get(courseID) || {
									id: courseID
								},
								subscription = iL.Subscription.get(subscriptionID) || {
									id: subscriptionID,
									course: course,
									student: student,
									unpaid: 0,
									lastPaymentIndex: 0,
									invoices: []
								},

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

							course.title = item.Coursename;
							course.code = item.CourseCode;
							/* This is the potential discount for existing students,
							   on this subscription.
							   The student is *not* necessarily entitled to this */
							course.existingDiscount = parseInt(item.DiscountForOldStudent);
							course.pricePerLesson = pricePerLesson;

							subscription.withdrawn = item.withdrawal == "1";

							iL.Course.add(course);
							iL.Subscription.add(subscription);

							dateIndex = invoice.year * 100 + invoice.month;

							if(!subscription.invoices){
								subscription.invoices = [];
							}

							subscription.invoices.push(invoice);

							if(!invoice.paid){
								subscription.unpaid += 1;
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
	 * @param student {object}
	 * @return {Promise(Student)} Prmoise resolves when server confirms student has been saved succesfully
	 */
	function saveStudent(student){
		if(!student.guardians || !student.guardians.length){
			student.guardians = [{}];
		}

		student.notes = student.notes.replace(existingRegex, "");

		if(student.existing){
			student.notes = $.trim(student.notes.replace(existingNewRegex, ""));
			student.notes += student.notes.length ? "\n" : "";
			student.notes += "Existing Student";
		}else{
			student.notes = $.trim(student.notes.replace(existingOldRegex, ""));
			student.notes += student.notes.length ? "\n" : "";
			student.notes += "New Student";
		}

		var guardian = student.guardians[0],
			post_data = {
				Action: student.id ? "update" : "insert",
				MemberID: student.id,
				MemberDetailNameinEnglish: student.englishName,
				MemberDetailRemark: student.notes,
				MemberDetailRemarkPayment: student.notesPayment,
				MemberDetailNameinChinese: student.nameChinese,
				MemberDetailNickname: student.name,
				MemberDetailBirthDay: iL.Util.formatDate(student.birthDate),
				MemberDetailGender: student.gender == "male" ? "1" : "0",
				MemberDetailGrade: student.grade,
				MemberDetailSchool: student.school,
				MemberDetailSchooltimefrom: student.schoolStart,
				MemberDetailSchooltimeto: student.schoolEnd,
				isSOCO: student.soco ? 1 : 0,
				GuardianDetailMemberID: guardian.accountID,
				GuardianDetailRelationship: guardian.relationship,
				GuardianDetailNameinEnglish: guardian.name,
				GuardianDetailNameinChinese: guardian.nameChinese,
				GuardianDetailNickname: guardian.nickname,
				GuardianDetailEmail: guardian.email,
				GuardianDetailAddress: guardian.address,
				GuardianDetailOccupation: guardian.occupation,
				GuardianDetailHomeNo: guardian.phoneHome,
				GuardianDetailMobileNo: student.phone,	/* Be careful! At the moment this is echoed back for both the
														   student and guardian but it is only saved under the guardian. We
														   keep track of it as part of the student for simplicity, which is
														   why we're using that value here - just incase it has been modified
														   on the student */
				GuardianDetailOfficeNo: guardian.phoneOffice,
				whyjoinusextendtext1: student.entryChannel1,
				whyjoinusextendtext2: student.entryChannel2
			};

		return Promise.resolve(
			$.post(iL.API_ROOT + "process_updateMemberInformation.php", post_data, null, "json")
		).then(function(data){
			if(!data || data.statuscode != "1"){
				return Promise.reject(Error("Server Rejected Student"));
			}
			if(!student.id){
				student.id = data.MemberID;
				student.accountID = data.SAccount;
				student.guardians[0].accountID = data.GAccount;
				student.registeredDate = new Date();
				iL.Util.parseName(student);
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
		return Promise.resolve(
			$.post(iL.API_ROOT + "process_updateMemberInvoice.php", post_data, null, "json")
		).then(function(data){
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
		return Promise.resolve(
			$.post(iL.API_ROOT + "process_removeMemberInvoice.php", post_data, null, "json")
		).then(function(data){
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
	 * @param id {int}
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
		$.each(subscriptions, function(i, subscription){
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
		subscriptions[subscription.id] = subscription;
	}
	Subscription.add = addSubscription;

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
			return Promise.resolve(
				$.post(iL.API_ROOT + "process_MemberCourseWithDrawal.php", post_data, "json")
			).then(function(){
				// invalidate attendances
				iL.Lesson
					.future(subscription.lastLesson)
					.then(function(lessons){
						lessons.forEach(function(lesson){
							iL.Attendance.find({lesson: lesson, clearCache: true});
						});
					});
			});
		}
		else {
			post_data = {
				Action: subscription.id ? "update" : "insert",
				MemberID: subscription.student.id,
				CoruseScheduleID: subscription.firstLesson.id, // [sic]
				StudentCourseRegistrationDate: iL.Util.formatDate(new Date()),
				StudentCoursePaymentcycle: 2 // [sic] per lesson
			};
			return Promise.resolve(
				$.post(iL.API_ROOT + "process_updateMemberCourse.php", post_data, null, "json")
			).then(function(data){
				if(!subscription.id){
					subscription.id = data.MemberCourseID;
					addSubscription(subscription);

					// invalidate attendances
					iL.Lesson
						.future(subscription.firstLesson)
						.then(function(lessons){
							lessons.forEach(function(lesson){
								iL.Attendance.find({lesson: lesson, clearCache: true});
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
		return Promise.resolve(
			$.post(iL.API_ROOT + "process_cancelMemberCourse.php", {MemberCourseID: subscription.id}, null, "json")
		).then(function(){
			// invalidate attendancess
		});
	}
	Subscription.remove = removeSubscription;

}(window));
