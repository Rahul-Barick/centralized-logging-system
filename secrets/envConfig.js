const env = require('./env.json');

module.exports = {
	'environmentName': 'local',
	'local':{
		"protocol": "http://",
		"subDomain": "",
		"domain": "localhost",
		"domainBasePath": "/",
		"appSSL": {
			"enabled": false,
			"cert": "",
			"key": ""
		}
	}
}