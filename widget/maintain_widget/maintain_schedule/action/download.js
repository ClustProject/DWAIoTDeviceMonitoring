let { custom, $scope } = widgetContext;
let t = custom.t;
const COLUMNS = [
  t('thingplus.label.device-name'),
  t('thingplus.label.date'),
  t('thingplus.time-format.hours'),
  t('thingplus.time-format.minute'),
];
let csv = COLUMNS.join(',') + '\r\n';
let todayTs = moment().startOf('day').valueOf();
console.log($scope.scheduleList);
for (let i in $scope.scheduleList) {
  for (let j in $scope.scheduleList[i].child) {
    for (let k in $scope.scheduleList[i].child[j].timeList) {
      // 시간이 오늘보다 크거나 같은 경우만
      let target = $scope.scheduleList[i].child[j].timeList[k];
      let targetTs = moment($scope.targetStart).date(target.index).startOf('day').valueOf();
      if (targetTs >= todayTs) {
        let label = `"${$scope.scheduleList[i].child[j].label}"`;
        let date = moment(targetTs).format('YYYY-MM-DD');
        let hour = Math.floor(target.value);
        let minute = Math.floor((target.value - hour) * 60);
        csv += label + ',' + date + ',' + hour + ',' + minute + '\r\n';
      }
    }
  }
}
let blob = new Blob(['\ufeff' + csv], {
  type: 'application/csv;charset=utf-8;',
});
let elem = window.document.createElement('a');
elem.href = window.URL.createObjectURL(blob);
elem.download = 'schedule_' + moment().format('YYYY-MM-DD_HH-mm-ss') + '.csv';
document.body.appendChild(elem);
elem.click();
document.body.removeChild(elem);
