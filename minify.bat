@echo off
echo Combining default modules
cat core.js calendar.js members.js report.js > studio-js-sdk.js
echo minifying studio-js-sdk.js
java -jar ..\yuicompressor-2.4.7\build\yuicompressor-2.4.7.jar -v -o studio-js-sdk.min.js studio-js-sdk.js
pause
