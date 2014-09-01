<?php
define('BASE_URL', "http://192.168.0.138/studio");
$request_uri = $_SERVER['REQUEST_URI'];
$script_name = $_SERVER['SCRIPT_NAME'];

if(strpos($request_uri,$script_name)===0){

	$path = substr($request_uri,strlen($script_name));
	$url = BASE_URL . $path;

	$method = $_SERVER['REQUEST_METHOD'];
	$response = proxy_request($url, ($method == "GET" ? $_GET : $_POST), $method);

	if($response['status'] == "ok"){

		$headerArray = explode("\r\n", $response['header']);
		foreach($headerArray as $headerLine) {
			header($headerLine);
		}

		echo $response['content'];
	}
	else {
		header("HTTP/1.1 400 Bad Request");

		echo $response['error'];
	}

}

/*--------------------------------------------------------------/
| PROXY.PHP                                                     |
| Created By: Évelyne Lachance                                  |
| Contact: eslachance@gmail.com                                 |
| Description: This proxy does a POST or GET request from any   |
|         page on the authorized domain to the defined URL      |
/--------------------------------------------------------------*/

// That's it for configuration!

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

function proxy_request($url, $data, $method) {
// Based on post_request from http://www.jonasjohn.de/snippets/php/post-request.htm

	// Convert the data array into URL Parameters like a=b&foo=bar etc.
	$data = http_build_query($data);
	$datalength = strlen($data);

	// parse the given URL
	$url = parse_url($url);

	if ($url['scheme'] != 'http') {
		die('Error: Only HTTP request are supported !');
	}

	// extract host and path:
	$host = $url['host'];
	$path = $url['path'];

	// open a socket connection on port 80 - timeout: 30 sec
	$fp = @fsockopen($host, 80, $errno, $errstr, 30);

	if ($fp){
		// send the request headers:
		if($method == "POST") {
			fputs($fp, "POST $path HTTP/1.1\r\n");
		} else {
			fputs($fp, "GET $path?$data HTTP/1.1\r\n");
		}
		fputs($fp, "Host: $host\r\n");

		fputs($fp, "Accept-Charset: ISO-8859-1,utf-8;q=0.7,*;q=0.7\r\n");

		   $requestHeaders = apache_request_headers();
		while ((list($header, $value) = each($requestHeaders))) {
			if($header == "Content-Length") {
				fputs($fp, "Content-Length: $datalength\r\n");
			} else if($header !== "Connection" && $header !== "Host") {
				fputs($fp, "$header: $value\r\n");
			}
		}
		fputs($fp, "Connection: close\r\n\r\n");

		if($method == "POST"){
			fputs($fp, $data);
		}

		$result = '';
		while(!feof($fp)) {
			// receive the results of the request
			$result .= fgets($fp, 1024);
		}
	}
	else {
		return array(
			'status' => 'err',
			'error' => "$errstr ($errno)",
			'errorstr' => $errstr,
			'errno' => $errno
		);
	}

	// close the socket connection:
	fclose($fp);

	// split the result header from the content
	$result = explode("\r\n\r\n", $result, 2);

	$header = isset($result[0]) ? $result[0] : '';
	$content = isset($result[1]) ? $result[1] : '';

	// return as structured array:
	return array(
		'status' => 'ok',
		'header' => $header,
		'content' => $content
	);
}
