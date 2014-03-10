YUI.add("yuidoc-meta", function(Y) {
   Y.YUIDoc = { meta: {
    "classes": [
        "Course",
        "Lesson",
        "Report",
        "Room",
        "Tutor",
        "Util"
    ],
    "modules": [
        "Calendar",
        "Core",
        "Report"
    ],
    "allModules": [
        {
            "displayName": "Calendar",
            "name": "Calendar",
            "description": "Calendar module. Contains Lesson and Course classes."
        },
        {
            "displayName": "Core",
            "name": "Core",
            "description": "Core module. Contains Tutor, Room classes as well as Utility submodule"
        },
        {
            "displayName": "Report",
            "name": "Report",
            "description": "Report module. Contains Report class."
        }
    ]
} };
});