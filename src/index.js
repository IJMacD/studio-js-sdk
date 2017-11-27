import {
  Tutor,
  User,
  Room,
  Term,
  getInitData,
  login,
  logout,
  checkLogin,
  getCurrentTutor,
} from './core';
import { Lesson, Course, Attendance } from './calendar';
import { Student, Invoice, Subscription } from './members';
import { Report } from './report';
import * as Util from './util';

export default {
  // Core
  Tutor,
  User,
  Room,
  Term,
  getInitData,
  login,
  logout,
  checkLogin,
  getCurrentTutor,

  // Calendar
  Lesson,
  Course,
  Attendance,

  // Members
  Student,
  Invoice,
  Subscription,

  // Report
  Report,

  // Util
  Util,
}
