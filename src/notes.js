(function(window){

  /**
   * Notes module. Contains Note class.
   *
   * @module Notes
   */
  var iLearner = window.iLearner || {},

      /**
      * Note class for dealing with notes
      *
      * @class Note
      */
      Note = {},
      
      // Internal cache
      _notes = {},
      // Promise cache
      _find = {};

  window.iL = iLearner;
  iLearner.Note = Note;

  /**
   * Get a note specified by ID
   *
   * @method get
   * @param id {int} Note ID
   * @return {object} Object representing the note
   */
  function getNote(id) {
    return _notes[id];
  }
  Note.get = getNote;

  /**
   * Internal method to default to correct note instance
   */
  function resolveNote(note) {
    return _notes[note.id] || note;
  }

  /**
   * Add a note to internal cache
   *
   * @method add
   * @param note {object} Note object
   */
  function addNote(note) {
    var existing = resolveNote(note) || {};

    if(existing !== note) {
      extend(existing, note);
    }

    _notes[note.id] = existing;

    return existing;
  }
  Note.add = addNote;

  /**
   * Find notes given specific paramaters
   *
   * @method find
   * @param params {object} Plain object containing params to search for
   * @return {Promise<Array<Object>>} Promise of an array of note objects
   */
  function findNote(options) {
    if(!options.student) {
      throw Error("Note.find(): You must specify a student");
    }

    var post_data = {
          student_id: options.student && options.student.id
        },
        cacheKey = JSON.stringify(post_data);

    if(!_find[cacheKey]) {
      _find[cacheKey] = iL.query("process_getNotes.php", post_data)
        .then(function (data) {
          if(data.error) {
            return Promise.reject(Error(data.error));
          }

          if(!data.messages) {
            return Promise.reject(Error("Note.find(): Unexpected reply from server"));
          }

          var pendingPromises = [];

          var output = data.messages.map(function (message) {
            var note = addNote({
                  id: message.id,
                  user: iL.User.get(message.user_id),
                  date: new Date(message.timestamp * 1000),
                  text: message.text,
                  student: iL.Student.get(message.student_id),
                  course: iL.Course.get(message.course_id),
                  lesson: iL.Lesson.get(message.lesson_id)
                });

            if(note.student) {
              addStudentMessage(note);
            }
            else {
              pendingPromises.push(
                iL.Student.fetch({id: message.student_id})
                  .then(function(student) {
                    note.student = student;
                    addStudentMessage(note);
                  })
              );
            }

            if(!note.course) {
              pendingPromises.push(iL.Course.fetch({id: message.course_id})
                .then(function(course) {
                  note.course = course;
                  if(!note.lesson) {
                    note.lesson = iL.Lesson.get(message.lesson_id);
                  }
                }).catch(function(){}));
            }

            // Lesson fetch does not exist
            // if(!note.lesson) {
            //   pendingPromises.push(iL.Lesson.fetch({id: message.lesson_id})
            //     .then(function(lesson){note.lesson = lesson}));
            // }

            return note;
          });

          return Promise.all(pendingPromises).then(function(){return output});
        });
    }

    return _find[cacheKey];
  }
  Note.find = findNote;

  function addStudentMessage (message) {
    var student = message.student;

    if(!student){
      return;
    }

    if(!student.messages) {
      student.messages = [];
    }

    if(student.messages.indexOf(message) == -1){
      student.messages.push(message);
    }
  }

  function extend(obj, props) {
      for(var prop in props) {
          if(props.hasOwnProperty(prop) && props[prop] != undefined) {
              obj[prop] = props[prop];
          }
      }
  }
}(window));
