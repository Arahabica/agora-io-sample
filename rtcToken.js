const { RtcTokenBuilder, RtcRole } = require('agora-access-token')

// Fill the appID and appCertificate key given by Agora.io
const appID = process.env.APP_ID;
const appCertificate= process.env.APP_CERTIFICATE;

// This is sample.
//const appID = "970CA35de60c44645bbae8a215061b33"
//const appCertificate= "5CFd2fd1755d40ecb72977518be15d3b"

// token expire time, hardcode to 3600 seconds = 1 hour
const expirationTimeInSeconds = 3600
const role = RtcRole.PUBLISHER

const generateRtcToken = function(req, resp) {
  const currentTimestamp = Math.floor(Date.now() / 1000)
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds
  const channelName = req.query.channelName;
  // use 0 if uid is not specified
  const uid = req.query.uid || 0
  if (!channelName) {
    return resp.status(400).json({ 'error': 'channel name is required' }).send();
  }

  var key = RtcTokenBuilder.buildTokenWithUid(appID, appCertificate, channelName, uid, role, privilegeExpiredTs);

  return resp.json({ 'key': key });
}

module.exports = generateRtcToken
