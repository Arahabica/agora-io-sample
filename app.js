const http = require('http')
const express = require('express')
const rtcToken = require('./rtcToken')
const PORT = 8080;


var app = express();
app.disable('x-powered-by');
app.set('port', PORT);

app.use(express.static('public'))

app.get('/rtcToken', rtcToken)


http.createServer(app).listen(app.get('port'), function() {
  console.log('open http://localhost:' + app.get('port'));
});
