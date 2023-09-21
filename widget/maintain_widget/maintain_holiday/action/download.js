let { custom, $scope } = widgetContext;
let t = custom.t;
const COLUMNS = [t('thingplus.label.holiday'), t('thingplus.label.date-range'), t('thingplus.label.content')];
let csv = COLUMNS.join(',') + '\r\n';
let todayTs = moment().startOf('day').valueOf();
for (let i in custom.mainData) {
  let holiday =
    addZero(custom.mainData[i].date.split('-')[0], 2) + '-' + addZero(custom.mainData[i].date.split('-')[1], 2);
  let dateRange = 'always';
  let content = custom.mainData[i].content;
  if (custom.mainData[i].isAlways == false) {
    if (custom.mainData[i].startYear == custom.mainData[i].endYear) {
      dateRange = custom.mainData[i].startYear;
    } else {
      dateRange = custom.mainData[i].startYear + '-' + custom.mainData[i].endYear;
    }
  }
  csv += holiday + ',' + dateRange + ',' + content + '\r\n';
}

let blob = new Blob(['\ufeff' + csv], {
  type: 'application/csv;charset=utf-8;',
});
let elem = window.document.createElement('a');
elem.href = window.URL.createObjectURL(blob);
elem.download = 'holiday_' + moment().format('YYYY-MM-DD_HH-mm-ss') + '.csv';
document.body.appendChild(elem);
elem.click();
document.body.removeChild(elem);

function addZero(value, pos) {
  let result = value.toString();
  for (let i = result.length; i < pos; i++) {
    result = '0' + result;
  }
  return result;
}
