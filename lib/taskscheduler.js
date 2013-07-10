var crypto      = require('crypto')
  , util        = require('util')
  , _           = require('underscore');

var TaskScheduler           = {}
  , handlers                = {}
  , taskPlugin
  , errBrokenTaskPluginMsg  = "Task plugin is not properly initialized. Aborting. "
  , brokenTaskPlugin        = true;

/**
* @taskPlugin - a task management plugin to put tasks on a queeu. 
*               @See: https://github.com/publicmediaplatform/sqstask
*/
TaskScheduler = function(taskPluginParam) {
  var brokenPlugin = isBrokenTaskPlugin(taskPluginParam);
  if (brokenPlugin) {
    throw new Error("Error: " + brokenPlugin);
  } else {
    taskPlugin = taskPluginParam; 
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

  var funcSalt  = jobFunction.toString() + topic + new Date().getTime()
    , handlerID = crypto.createHash('md5').update(funcSalt).digest("hex");
      
  // Make sure this handler was not already attached and attach:
  if ('undefined' === typeof handlers[handlerID]) {
    var timerID = setInterval(jobFunctionWrapper, interval, jobFunction, topic);
    handlers[handlerID] = { "jobFunction"     : jobFunction
                          , "topic"           : topic
                          , "interval"        : interval
                          , "timerID"         : timerID};
    
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
exports.getTopicHandlers = function(topic) {
  if ('undefined' === typeof handlers[topic]) {
    return [];
  }
  
  return _.values(handlers[topic]);
}**/


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
function jobFunctionWrapper(jobFunction, topic) {

  taskPlugin.get(topic, function(err, message, msgID) {
    if (message != null) {
      jobFunction(topic, message, function cleanupCallback(err) {
        if (!err) {
          taskPlugin.del(topic, msgID, function(err) {
            if (err) util.log(err);
          });
        } else { // release message back to the queue
          // Unfortunately, some queues (e.g. SQS) have no concept of releasing a locked message
          // so to keep things abstract, unfortunately, the safest thing is to delete and re-send
          // the message :(
          taskPlugin.del(topic, msgID, function(err) {
            if (!err) {
              util.log("Job processing error. Reposting message: " + message);
              taskPlugin.put(topic, message, function resendCallback(err) {
                if (err) util.log(err);
              });
            } else {
              if (err) util.log(err);
            }
          });
          
          
        }
      });        
    }
  }); 
  
}

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

  if (typeof taskPlugin.del  !== 'function') {
    err = "Task plugin doesn't export a del() function.";
  }
  
  return err;
}