taskscheduler
=============

A topic-based task scheduler for Node.js. Allows scheduling multiple handlers per topic. 

## USAGE

### Registering a Handler

```javascript
var scheduler = require('taskscheduler');
var interval = 200; // call tasks every 200 milliseconds.
var topic = "publish message";
var publishExecutor = function (topic, callback) {
  
  console.log("publisher called");
  callback(null, topic, "22222");  
}; 

var cleanupCallback = function(err, topic, reciept) {
  // ...
};

var handlerID = scheduler.addTopicHandler( topic, 
                                         , publishExecutor
                                         , cleanupCallback
                                         , interval);
```

### De-activating a Handler

```javascript
  scheduler.removeTopicHandler(handlerID);
```
