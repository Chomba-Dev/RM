require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const { google } = require('googleapis');
// Use Multer memory storage for Vercel compatibility
const upload = require('multer')({ storage: require('multer').memoryStorage() });
const index = express();
const PORT = process.env.PORT || 3000;
const session = require('express-session');

// Google OAuth2 setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

index.use(express.static(path.join(__dirname, 'public')));
index.set('view engine', 'ejs');
index.set('views', path.join(__dirname, 'views'));

// Middleware to parse form data
index.use(express.urlencoded({ extended: true }));
index.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true,
}));

index.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

index.get('/auth/google', (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
  ];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });
  res.redirect(url);
});

index.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('No code provided');
  try {
    const { tokens } = await oauth2Client.getToken(code);
    req.session.tokens = tokens;
    oauth2Client.setCredentials(tokens);
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to authenticate with Google');
  }
});

// Middleware to restrict access to a specific email
function restrictToEmail(req, res, next) {
  if (!req.session.tokens) {
    return res.redirect('/auth/google');
  }
  const { id_token } = req.session.tokens;
  if (!id_token) {
    return res.status(403).send('Access denied: No ID token');
  }
  const jwt = require('jsonwebtoken');
  const decoded = jwt.decode(id_token);
  if (!decoded || decoded.email !== 'chomba.business.gershom@gmail.com') {
    return res.status(403).send('Access denied: Unauthorized email');
  }
  next();
}

index.post('/upload', restrictToEmail, upload.single('document'), async (req, res) => {
  const buyerEmail = req.body.email;
  const file = req.file;
  if (!buyerEmail || !file) {
    return res.status(400).send('Missing email or file');
  }

  if (!req.session.tokens) {
    return res.redirect('/auth/google');
  }
  oauth2Client.setCredentials(req.session.tokens);
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  try {
    // Upload file to Google Drive from memory
    const driveRes = await drive.files.create({
      requestBody: {
        name: file.originalname,
        mimeType: file.mimetype,
      },
      media: {
        mimeType: file.mimetype,
        body: Buffer.from(file.buffer),
      },
    });
    const fileId = driveRes.data.id;

    // Set permissions for buyer's Gmail
    await drive.permissions.create({
      fileId,
      requestBody: {
        type: 'user',
        role: 'reader',
        emailAddress: buyerEmail,
      },
      fields: 'id',
    });

    // Restrict download, print, copy
    await drive.files.update({
      fileId,
      requestBody: {
        copyRequiresWriterPermission: true,
        viewersCanCopyContent: false,
      },
    });

    // Redirect to dashboard with success message
    res.redirect('/?success=1&email=' + encodeURIComponent(buyerEmail));
  } catch (err) {
    console.error(err);
    res.redirect('/?success=0');
  }
});

index.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

console.log('Happy developing ✨')
