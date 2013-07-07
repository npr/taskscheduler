var crypto      = require('crypto')
  , _           = require('underscore');

var handlers = {};

exports = module.exports = function() {
  
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
exports.addTopicHandler = function(topic, jobFunction, cleanupCallback, interval) {

  var funcSalt = jobFunction.toString() + topic + new Date().getTime()
    , handlerID = crypto.createHash('md5').update(funcSalt).digest("hex");
  
  // Make sure this handler was not already attached and attach:
  if ('undefined' === typeof handlers[handlerID]) {
    var timerID = setInterval(jobFunction, interval, topic, cleanupCallback);
    handlers[handlerID] = { "jobFunction"     : jobFunction
                          , "cleanupCallback" : cleanupCallback
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
exports.removeTopicHandler = function(handlerID) {
  
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
exports.getTopicHandlers = function(topic) {
  if ('undefined' === typeof handlers[topic]) {
    return [];
  }
  
  return _.values(handlers[topic]);
}**/