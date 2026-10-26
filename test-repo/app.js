// Vulnerable application code
const express = require('express');
const app = express();

// Hardcoded secret!
const GITHUB_TOKEN = 'ghp_abcdefghijklmnopqrstuvwxyz123456789';

// AWS credentials in code
const AWS = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
};

// Private key embedded
const privateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1234567890...
-----END RSA PRIVATE KEY-----`;

app.listen(3000);
