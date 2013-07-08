taskscheduler
=============

A topic-based task scheduler for Node.js. Allows for pluggable queue implementation. 

For a sample queue plugin that uses Amazon SQS, see: [SQSTask](https://github.com/publicmediaplatform/sqstask)

## Status

A [very] early release. Feel free to: inspect, hack, enjoy and contribute (e.g.: feedback, documentation or bug fixes), 
but use at your own risk in production. 

## USAGE

### Registering a Handler

```javascript

var AWSConfig = {
      "accessKeyId"     : "..."
    , "secretAccessKey" : "..."
    , "awsAccountId"    : "..."
  };

var util    = require('util')
  , sqstask = require('../sqstask')(AWSConfig)
  , ts      = require('../taskscheduler')(sqstask);

var publisherHandlerID = ts.addTopicHandler("publisher", taskJob, 100);

var taskJob = function(topic, message, callback) {

  console.dir("Task job fired, with message: " + message);
   
  var err = null;
  
  var random = Math.floor(Math.random() * 5) + 1;
  if (random === 5) {
    err = new Error("something");
    console.log("Error simulated for message: " + message);
  }    

  callback(err);
    
};

//-- You can also de-register a task, if you don't want it running "forever".

setTimeout(function(hID) {
  ts.removeTopicHandler(hID);
}, 1000, publisherHandlerID);
```

### Sending messages

```javascript
var amazon = require('awssum-amazon');

// @see: http://awssum.io/amazon/
var AWSConfig = {
      "accessKeyId"     : "..."
    , "secretAccessKey" : "..."
    , "awsAccountId"    : "..."
    , "quequePrefix"    : "task"
    , "region"          : amazon.US_WEST_2 
  };

var sqstask = require('../sqstask')(AWSConfig);

// Note: you do not have to pre-create queues corresponding to topics. 
// They will be automatically created for you if they do not exist.
for (var i = 0; i<5; i++) {
  sqstask.put( "publisher"
             , "This is message # " + new Date().getTime()
             , function(err, result) {
    if (err) {
      util.log("Error sending a message to the queue: " + util.inspect(err.Body.ErrorResponse.Error));
      console.log(err);
    }
  });
}
```
