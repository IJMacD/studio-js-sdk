<?php
$request = basename($_SERVER['REQUEST_URI']);

switch ($request) {
	case 'process_getinitdata.php':
		echo file_get_contents("getInitData.json");
		break;

	case 'process_login.php':
		if(isset($_POST['login']) &&
			isset($_POST['password']) &&
			$_POST['login'] == "tutor" &&
			$_POST['password'] == "itutor123") 
		{
			echo file_get_contents("login-success.json");
		}
		else
		{
			echo file_get_contents("login-fail.json");
		}
		break;
	
	case 'process_getCalendarData.php':
		if(isset($_POST['sDate']) &&
			$_POST['sDate'] == "2014/3/19")
		{
			if(isset($_POST['Tutor']))
			{
				if($_POST['Tutor'] == "3639")
				{
					echo file_get_contents("getCalendarData-20140319-3639.json");
				}
			}
			else
			{
				echo file_get_contents("getCalendarData-20140319.json");
			}
		}
		break;

	case 'process_getCourseDetail.php':
		if(isset($_POST['courseID']))
		{
			if($_POST['courseID'] == "3002")
			{
				echo file_get_contents("getCourseDetail-3002.json");
			}
			else if($_POST['courseID'] == "2807")
			{
				echo file_get_contents("getCourseDetail-2807.json");
			}
		}
		
		break;

	case 'process_getMemberReportCardList.php':
		if(isset($_POST['searchTutor']) &&
			$_POST['searchTutor'] == "3967")
		{
			echo file_get_contents("getMemberReportCardList-3967.json");
		}
		break;

	case 'process_getCourseScheduleStudents.php':
		if(isset($_POST['scheduleID']) &&
			$_POST['scheduleID'] == "25076")
		{
			echo file_get_contents("getCourseScheduleStudents-25076.json");
		}
		break;

	default:
		# code...
		break;
}
