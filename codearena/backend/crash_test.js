try {
  require('./src/server.js');
} catch (e) {
  require('fs').writeFileSync('crash_log.txt', e.stack);
}
