const path = require('path');

module.exports = function setupProxy(app) {
  const sendLegal = (file) => (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', file));
  };
  app.get(['/privacy', '/privacy/'], sendLegal('privacy.html'));
  app.get(['/terms', '/terms/'], sendLegal('terms.html'));
};
