<?php
define('BASE_URL', "http://192.168.0.138/studio");
$request_uri = $_SERVER['REQUEST_URI'];
$script_name = $_SERVER['SCRIPT_NAME'];
if(strpos($request_uri,$script_name)===0){
	$path = substr($request_uri,strlen($script_name));
	$url = BASE_URL . $path;
	$options = array(
		'http' => array(
			'method'  => 'POST',
			'header' => "Content-type: application/x-www-form-urlencoded",
			'content' => http_build_query($_POST),
		),
	);
	$context  = stream_context_create($options);
	$result = file_get_contents($url, false, $context);

	echo $result;
}
?>
