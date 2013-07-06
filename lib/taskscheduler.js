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
* @param callback
*   A javascript function that will be called every @interval (see below) milliseconds. 
* @interval
*   Time interval (in milliseconds) that callback will be called for the topic.
*
* @return A unique identifier of the callback that can be used in the future to de-register the handler function.
*/
exports.addTopicHandler = function(topic, callback, interval) {

  var funcSalt = callback.toString() + topic + new Date().getTime()
    , handlerID = crypto.createHash('md5').update(funcSalt).digest("hex");
  
  // Make sure this handler was not already attached and attach:
  if ('undefined' === typeof handlers[handlerID]) {
    var timerID = setInterval(callback, interval, topic);
    handlers[handlerID] = { "callback" : callback
                          , "topic"    : topic
                          , "interval" : interval
                          , "timerID"  : timerID};
    
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