taskscheduler
=============

A topic-based task scheduler for Node.js. Allows scheduling multiple handlers per topic. 

## USAGE

### Registering a Handler

```javascript
var scheduler = require('taskscheduler');
var interval = 200;

var handlerID = scheduler.addTopicHandler("publish message", function publishExecutor() {
  
  console.log("publisher called");
    
}, interval);
```

### De-activating a Handler

```javascript
  scheduler.removeTopicHandler(handlerID);
```
