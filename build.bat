@echo off
if not exist build md build
echo Combining default modules
cat core.js calendar.js members.js report.js > ./build/studio-js-sdk.js
echo minifying studio-js-sdk.js
java -jar .\yuicompressor-2.4.8.jar -v -o ./build/studio-js-sdk.min.js ./build/studio-js-sdk.js
echo Complete
pause
