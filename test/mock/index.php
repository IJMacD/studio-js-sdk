<?php
$request = basename($_SERVER['REQUEST_URI']);

$DATA_DIR = "2016-09-01";

if(!function_exists('apache_request_headers')) {
// Function is from: http://www.electrictoolbox.com/php-get-headers-sent-from-browser/
	function apache_request_headers() {
		$headers = array();
		foreach($_SERVER as $key => $value) {
			if(substr($key, 0, 5) == 'HTTP_') {
				$headers[str_replace(' ', '-', ucwords(str_replace('_', ' ', strtolower(substr($key, 5)))))] = $value;
			}
		}
		return $headers;
	}
}

$requestHeaders = apache_request_headers();

if(isset($requestHeaders['Origin'])){
	header("Access-Control-Allow-Origin: " . $requestHeaders['Origin']);
	header("Access-Control-Allow-Credentials: true");
}

function echoFile($name){
	global $DATA_DIR;

	sleep(1);

	$filename = "data/" . $DATA_DIR . "/" . $name . ".json";

	if(file_exists($filename)) {
		echo file_get_contents($filename);
	}
	else {
		$raw_filename = "data/" . $DATA_DIR . "/" . $name;
		if(file_exists($raw_filename)) {
			echo file_get_contents($raw_filename);
		}
		else {
			echo '{"error":true}';
		}
	}
}

switch ($request) {
	case 'process_getinitdata.php':
		echoFile("getInitData");
		break;

	case 'process_login.php':
		if(isset($_POST['login']) &&
			isset($_POST['password']) &&
			$_POST['login'] == "tutor" &&
			$_POST['password'] == "itutor123")
		{
			echoFile("login");
		}
		else
		{
			echoFile("login");
		}
		break;

	case 'process_getCalendarData.php':
		if(isset($_POST['Tutor']) && strlen($_POST['Tutor']))
		{
			if($_POST['Tutor'] == "3639")
			{
				echoFile("getCalendarData-20140319-3639");
			}
		}
		else
		{
			echoFile("getCalendarData");
		}
		break;

	case 'process_getCourseDetail.php':
		if(isset($_POST['courseID']))
		{
			if($_POST['courseID'] == "3002")
			{
				echoFile("getCourseDetail-3002");
			}
			else if($_POST['courseID'] == "2807")
			{
				echoFile("getCourseDetail-2807");
			}
		}

		break;

	case 'process_getMemberReportCardList.php':
		if(isset($_POST['searchTutor']) &&
			$_POST['searchTutor'] == "3967")
		{
			echoFile("getMemberReportCardList-3967");
		}
		break;

	case 'process_getCourseScheduleStudents.php':
		if(isset($_POST['scheduleID']) &&
			$_POST['scheduleID'] == "25076")
		{
			echoFile("getCourseScheduleStudents-25076");
		}
		break;

	case 'process_getMemberDetail.php':
		if(isset($_POST['memberID']))
		{
			if($_POST['memberID'] == "4798")
			{
				echoFile("getMemberDetail");
			}
		}

		break;

	case 'process_getNotes.php':
		if(isset($_POST['student_id']))
		{
			if($_POST['student_id'] == "4798")
			{
				echoFile("getNotes");
			}
		}

		break;

	default:
		echoFile("index.html");
}
