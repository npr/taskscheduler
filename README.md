taskscheduler
=============

A simple, queue-backed and topic-oriented task scheduler for Node.js with pluggable queue implementation. 

For a sample queue plugin that uses Amazon SQS, see: [SQSTask](https://github.com/publicmediaplatform/sqstask)

## TL;DR

A simple call: 

```javascript
scheduler.addTopicHandler(sometopic, taskJob, 100);
```

will schedule a javascript function (`taskjob` in this case) that can "listen" to incoming messages on a `sometopic` topic 
in a queue every 100 milliseconds. A `taskjob` implementation receives: (topic, message, callback) arguments when called. A 'topic' is typically 
a separate queue/channel on a message queue. 

You can send messages asynchronously to the queue with:

```javascript
 scheduler.message( sometopic
                  , somemessage
                  , function(err, result) {
      if (err) {
       // handle error
      }
    });
```

## Status

An early release. Feel free to: inspect, hack, enjoy and contribute (e.g.: feedback, documentation or bug fixes), 
but consider it an "alpha" stability. 

## Installation

```bash
> npm install taskscheduler
> npm install sqstask
```

## USAGE

Before you can use taskscheduler you have to configure it:

### Setup

```javascript

var AWSConfig = {
      "accessKeyId"     : "..."
    , "secretAccessKey" : "..."
    , "awsAccountId"    : "..."
  };

var util      = require('util')
  , sqstask   = require('sqstask')(AWSConfig)
  , scheduler = require('taskscheduler')(sqstask);
  
```  

### Registering a Handler

```javascript
var publisherHandlerID = scheduler.addTopicHandler("publisher", taskJob, 100);

function taskJob(topic, message, callback) {

  console.dir("Task job fired, with message: " + message);
   
  var err = null;
  
  var random = Math.floor(Math.random() * 5) + 1;
  if (random === 5) {
    err = new Error("something");
    console.log("Error simulated for message: " + message);
  }    

  callback(err);
    
};
```

### De-Registering a Handler

```javascript
//-- You can also de-register a task, if you don't want it running "forever".

setTimeout(function(hID) {
  scheduler.removeTopicHandler(hID);
}, 1000, publisherHandlerID);
```

### Sending messages

```javascript

scheduler.topicEnsureExists(test_topic, function(err) {

  if (!err) {
    sendmessagesAndReadMessages();
  } else {
    console.dir(err);
  }

  
}); // end of topic ensuring.


function  sendmessagesAndReadMessages() {
  for (var i = 0; i<5; i++) {
    scheduler.message( "publisher"
                     , "This is message # " + new Date().getTime()
                     , function(err, result) {
      if (err) {
        util.log("Error sending a message to the queue: " + util.inspect(err.Body.ErrorResponse.Error));
        console.log(err);
      }
    });
  }
}
```

### Plugin Implementation

To implement a plugin for a different queue, you must write a proper Node.js module that complies to the following requirements:

1. Implements and exports following methods:
    - put(topic, message, callback) : puts a message on a queue.
    - get(topic, callback) : fetches a message from a queue
    - topicEnsureExists(topic, callback) : checks if a topic (queue) exists on a queue and creates one if it doesn't.    
1. Implements and exports a Message class that:
    - supports topic, body and id properties and has a constructor: (topic, body, id)
    - release(callback) method which returns previously grabbed (and locked) message back to the queue
    - del(callback) method that deletes a method from the queue    
    
For a sample of a properly implemented queue task, inspect the source code of [SQSTask](https://github.com/publicmediaplatform/sqstask)    

