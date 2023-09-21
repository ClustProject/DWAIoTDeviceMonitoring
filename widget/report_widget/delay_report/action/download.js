let { custom, $scope } = widgetContext;

let csv = $scope.thList.map(x => x.label) + '\r\n';

for (let i in custom.mainData) {
  let datas = [];
  for (let j in $scope.thList) {
    let formatter = $scope.thList[j].formatter;
    let data = custom.mainData[i][$scope.thList[j].key];
    if (formatter) {
      data = formatter(data);
    }
    datas.push(data);
  }
  csv += datas.join(',') + '\r\n';
}

fileDownload(csv);

function fileDownload(content) {
  let blob = new Blob(['\ufeff' + content], {
    type: 'application/csv;charset=utf-8;',
  });
  let elem = window.document.createElement('a');
  elem.href = window.URL.createObjectURL(blob);
  elem.download = `Delay_Report_${moment(custom.startTs).format('YYYY-MM-DD')} ${moment(custom.endTs).format(
    'YYYY-MM-DD'
  )}.csv`;
  document.body.appendChild(elem);
  elem.click();
  document.body.removeChild(elem);
}
