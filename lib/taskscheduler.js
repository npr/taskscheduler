var crypto      = require('crypto')
  , util        = require('util')
  , _           = require('underscore');

var TaskScheduler           = {}
  , handlers                = {}
  , taskPlugin
  , errBrokenTaskPluginMsg  = "Task plugin is not properly initialized. Aborting. "
  , brokenTaskPlugin        = true;

/**
 * @type {number} Number of milliseconds between reads from the queue service
 */
var jobInterval = 0;

/**
 * @type {number} Number of poll failures before workers kill themselves. Set to 0 for non-suicidal workers.
 * Useful if managing worker lifecycle dynamically.
 */
var workerSuicide = 0;

/**
* @taskPlugin - a task management plugin to put tasks on a queeu.
*               @See: https://github.com/publicmediaplatform/sqstask
*/
TaskScheduler = function(taskPluginParam, maxAttempts) {
  var brokenPlugin = isBrokenTaskPlugin(taskPluginParam);
  if (brokenPlugin) {
    throw new Error("Error: " + brokenPlugin);
  } else {
    taskPlugin = taskPluginParam;
  }
  if(maxAttempts)
  {
    workerSuicide = parseInt(maxAttempts);
  }

  return exports;
};

/**
* Adds a handler callback to a topic.
*
* @param topic
*   Topic name. Any unique string
* @param jobFunction
*   A javascript function that will be called every @interval (see below) milliseconds.
*
* @param cleanupCallback
*   A javascript function that jobFunction will continue to passing along the "err" object. This function's purpose is to do cleanup.
*   Often single cleanup function is relevant for many task types, that is why this is separate. This functionality is heavily used
*   by SQS Task plugin, for instance, which uses cleanup to remove initial message from the message queue.
*
* @interval
*   Time interval (in milliseconds) that callback will be called for the topic.
*
* @return A unique identifier of the callback that can be used in the future to de-register the handler function.
*/
TaskScheduler.addTopicHandler = function(topic, jobFunction, interval) {

  if (!taskPlugin) {
    throw new Error(errBrokenTaskPluginMsg);
    return;
  }

  if(interval && _.isNumber(interval)) {
    jobInterval = interval;
  }

  var funcSalt  = jobFunction.toString() + topic + new Date().getTime()
    , handlerID = crypto.createHash('md5').update(funcSalt).digest("hex");

  // Make sure this handler was not already attached and attach:
  // TODO: Fix how jobs are stopped since we are no longer using setInterval
  if ('undefined' === typeof handlers[handlerID]) {
    queueNextJob(jobFunction, topic, handlerID);
    handlers[handlerID] = { "jobFunction"     : jobFunction
                          , "topic"           : topic
                          , "interval"        : jobInterval
                          , "timerID"         : 0
                          , "pollFailures"    : 0
    , "asleep" : false};

  }

  return handlerID;
};

/**
* De-register a topic handler callback by the unique ID that was generated
* when the handler was attached to the topic.
*
* Returns true if de-registering was successful, false otherwise.
*/
TaskScheduler.removeTopicHandler = function(handlerID) {

  if (!taskPlugin) {
    throw new Error(errBrokenTaskPluginMsg);
    return;
  }

  // Does the handler exist?
  if ('undefined' === typeof handlers[handlerID]) {
    return false
  }

  var timerID = handlers[handlerID].timerID;
  clearInterval(timerID);
  delete handlers[handlerID];
  return true;
}

/**
* Check if a topic exists, create if it doesn't
*/
TaskScheduler.topicEnsureExists = function(topic, callback) {
  taskPlugin.topicEnsureExists(topic, function(err) {
    callback(err);
  });
}

/**
* Send a message to the queue
*/
TaskScheduler.message = function(topic, message, callback) {
  taskPlugin.put(topic, message, function(err) {
    callback(err);
  });
}

/**
 * Enabling a get function for use to get a single message
 * @param topic
 * @param callback
 */
TaskScheduler.get = function(topic, callback) {
  taskPlugin.get(topic, function(getError, message){
    if (('undefined' != typeof message) && ('undefined' !== typeof message.body) && message.body) {
      callback(getError, message, function cleanup(processingError) {
        if (processingError) {
          util.log("Job processing error. Releasing message: " + message.body);
          message.release(function (err) {
            if (err) {
              console.log("Error releasing message" + err.message);
            }
          });
        } else {
          message.del(function (err) {
            if (err) {
              console.log("Error deleting message: " + err.message);
            }
          });
        }
      });
    } else {
        callback();
    }
  });
};
/**
 * Resets the pollFailure count for each handler and
 * sets a queueNextJob for each handler
 *
 * @param handlerID
 */
TaskScheduler.wakeUpHandler = function (handlerID) {
    util.log('handler asleep ? ' + handlers[handlerID].asleep);
    if (handlers[handlerID].asleep) {
        util.log("waking up" + handlerID);
        // Reset suicide count
        handlers[handlerID].pollFailures = 0;
        handlers[handlerID].asleep = false;
        queueNextJob(handlers[handlerID].jobFunction, handlers[handlerID].topic, handlerID);
    }
};

/**
* Message class. Every plugin MUST extend this properly, with:
* Message.prototype.__proto__ = scheduler.Message.prototype;
*/
TaskScheduler.Message = function(body, id) {
  this.body = body || "";
  this.id   = id || null;
}
TaskScheduler.Message.prototype.del     = function(callback) {};
TaskScheduler.Message.prototype.release = function(callback) {};


exports = module.exports = TaskScheduler;


//---- Private functions.
//---- These are defined as regular functions so that they don't need to be declared before they are used!


/**
* A callback that wraps custom job functions to provide centralized post-job cleanup: delete message
* from a queue if a job was successful and/or re-post a job on the queue, so it can be retried, if
* the job was unsuccessful.
*
* @TODO: add max_number_or_retries to reposting a job to the queue.
*/
function jobFunctionWrapper(jobFunction, topic, handlerID) {
  taskPlugin.get(topic, function(err, message) {
    if (('undefined' != typeof message) && ('undefined' !== typeof message.body) && message.body) {
      jobFunction(topic, message.body, function cleanupCallback(err) {
          // If no error, then success; if we kept trying but didn't get anything, spin workers down
        if (!err) {
          message.del(function(err) {
            if (err) util.log("Error deleting a message: " + util.inspect(err));
            //util.log("DELETED: " + message.body);
          });
            // Queue next job before delete
            queueNextJob(jobFunction, topic, handlerID);
            return;
        } else { // release message back to the queue
          util.log("Job processing error. Releasing message: " + message.body);
          message.release(function(err2) {
            if (err2) util.log(util.inspect(err2));
            handlers[handlerID].pollFailures++;
            queueNextJob(jobFunction, topic, handlerID);
            return;
          });
        }
      });
    } else {
        if(handlers[handlerID].pollFailures >= workerSuicide) {
            // Stop polling until we wake the handler back up
            handlers[handlerID].asleep = true;
            util.log("asleep: " + handlerID);
            return;
        }
      handlers[handlerID].pollFailures++;
      queueNextJob(jobFunction, topic, handlerID);
    }
  });
}

/**
 * Start the next read from the queue, waiting 'jobInterval' milliseconds
 * TODO: setup a way to stop the next job from executing
 *
 * @param jobFunction
 * @param topic
 */
function queueNextJob(jobFunction, topic, handlerID) {
  setTimeout(jobFunctionWrapper, jobInterval, jobFunction, topic, handlerID);
};

function isBrokenTaskPlugin(taskPlugin) {
  var err = false;

  if (typeof taskPlugin  !== 'function') {
    err = "Task plugin is empty or not a proper function/object.";
  }

  if (typeof taskPlugin.get  !== 'function') {
    err = "Task plugin doesn't export a get() function.";
  }

  if (typeof taskPlugin.put  !== 'function') {
    err = "Task plugin doesn't export a put() function.";
  }

  if (typeof taskPlugin.topicEnsureExists  !== 'function') {
    err = "Task plugin doesn't export a topicEnsureExists() function.";
  }

  if (typeof taskPlugin.Message.prototype.del  !== 'function') {
    err = "Task plugin doesn't export a del() function on a message class.";
  }

  if (typeof taskPlugin.Message.prototype.release  !== 'function') {
    err = "Task plugin doesn't export a del() function on a message class.";
  }

  return err;
}
