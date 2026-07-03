const { weatherRefresh } = require('./weatherRefresh');

function startCronJobs() {
  return weatherRefresh;
}

module.exports = { startCronJobs };