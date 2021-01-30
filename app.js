const http = require('http')
const express = require('express')
const rtcToken = require('./rtcToken')
const PORT = 8080;

if (!process.env.APP_ID || !process.env.APP_CERTIFICATE) {
  throw new Error("required APP_ID and APP_CERTIFICATE environment variables.")
}

var app = express();
app.disable('x-powered-by');
app.set('port', PORT);

app.use(express.static('public'));

app.get('/rtcToken', rtcToken);
app.get('/appId',  (req, resp) =>  resp.json({ 'appId': process.env.APP_ID }));

http.createServer(app).listen(app.get('port'), function() {
  console.log('open http://localhost:' + app.get('port'));
});
