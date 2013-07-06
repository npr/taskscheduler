var crypto      = require('crypto')
  , _           = require('underscore');

var handlers = {};

exports = module.exports = function() {
  
};

/**
* Adds a handler callback to a topic. 
*
* @return A unique identifier of the callback that can be used in the future to de-register the handler function.
*/
exports.addTopicHandler = function(topic, callback) {

  var funcSalt = callback.toString() + new Date().getTime()
    , handlerID = crypto.createHash('md5').update(funcSalt).digest("hex");

  // Create topic if one doesn't already exist
  if ('undefined' === typeof handlers[topic]) {
    handlers[topic] = {};
  }
  
  // Make sure this handler was not already attached and attach:
  if ('undefined' === typeof handlers[topic][handlerID]) {
    handlers[topic][handlerID] = callback;
  }
  
  return handlerID;
};

/**
* De-register a topic handler callback by the unique ID that was generated
* when the handler was attached to the topic.
*
* Returns true if de-registering was successful, false otherwise.
*/ 
exports.removeTopicHandler = function(topic, handlerID) {
  
  // Does the topic exist?
  if ('undefined' === typeof handlers[topic]) {
    return false;
  }
  
  // Does the handler exist?
  if ('undefined' === typeof handlers[topic][handlerID]) {
    return false
  }
  
  delete handlers[topic][handlerID];
  return true;
}

exports.getTopicHandlers = function(topic) {
  if ('undefined' === typeof handlers[topic]) {
    return [];
  }
  
  return _.values(handlers[topic]);
}