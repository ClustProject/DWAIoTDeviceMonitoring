let $injector = widgetContext.$scope.$injector;
let customDialog = $injector.get(widgetContext.servicesMap.get('customDialog'));
let attributeService = $injector.get(widgetContext.servicesMap.get('attributeService'));

const MINUTE_MS = 60000;
const HOUR_MS = 60 * MINUTE_MS;

const t = widgetContext.custom.t;

openAddEntityDialog();

function openAddEntityDialog() {
  customDialog.customDialog(htmlTemplate, AddEntityDialogController).subscribe();
}

function AddEntityDialogController(instance) {
  let vm = instance;
  vm.ownerId = widgetContext.defaultSubscription.configuredDatasources[0].entity.id;
  vm.dashboardList = [];
  vm.src = '';
  vm.t = t;
  vm.highlight = '';
  vm.newInfo = [];

  vm.addEntityFormGroup = vm.fb.group({});

  vm.calcFontSize = function () {
    const originWidth = widgetContext.settings.widget.originWidth;
    let widgetFontSize = _.round((widgetContext.width / originWidth) * 10, 2);
    if (widgetFontSize < 6.25) {
      widgetFontSize = 6.25;
    }
    return widgetFontSize;
  };
  vm.cancel = function () {
    vm.dialogRef.close(null);
  };
  vm.save = async function () {
    vm.addEntityFormGroup.markAsPristine();
    getAttribute().subscribe(datas => {
      saveAttribute(datas).subscribe(() => {
        widgetContext.updateAliases();
        vm.dialogRef.close(null);
      });
    });
  };
  vm.onDragOver = function (e) {
    e.preventDefault();
    e.stopPropagation();
    vm.highlight = 'highlight';
  };
  vm.onDragEnter = function (e) {
    e.preventDefault();
    e.stopPropagation();
    vm.highlight = 'highlight';
  };
  vm.onDragLeave = function (e) {
    e.preventDefault();
    e.stopPropagation();
    vm.highlight = '';
  };
  vm.onDrop = function (e) {
    e.preventDefault();
    e.stopPropagation();
    vm.highlight = '';
    vm.handleFiles(e, true);
  };
  vm.removeSchedule = function (e) {
    vm.src = '';
  };
  vm.handleFiles = function (e, isDrag) {
    let files;
    if (isDrag) {
      files = e.dataTransfer.files;
    } else {
      files = e.target.files;
    }
    vm.fileName = files[0].name;
    vm.fileType = files[0].type;
    vm.fileSize = files[0].size;

    if (vm.fileSize > 512 * 1024) {
      window.alert(t('thingplus.help.error-big-schedule'));
      return;
    }
    let reader = new FileReader();
    reader.readAsText(files[0]);
    reader.onloadend = function () {
      vm.src = reader.result;

      let rows = vm.src.split('\r\n');
      rows = rows.slice(1);
      for (let i in rows) {
        if (rows[i] && rows[i] != '') {
          let data = rows[i].split(',');
          let date = [0, 0];
          let isAlways = false;
          let applyDate = ['', ''];
          if (!/^[0-9]{1,2}-[0-9]{1,2}$/.test(data[0])) {
            continue;
          }
          if (/^[0-9]{1,2}-[0-9]{1,2}$/.test(data[0])) {
            let temp = data[0].split('-');
            date[0] = Number(temp[0]);
            date[1] = Number(temp[1]);
            if (date[0] > 12 || date[1] > 31 || date[0] < 1 || date[1] < 1) {
              continue;
            }
            if (date[0] == 2 && date[1] > 29) {
              continue;
            }
            if ([4, 6, 9, 11].includes(date[0]) && date[1] > 30) {
              continue;
            }
          }
          if (data[1].toLowerCase() == 'always') {
            isAlways = true;
          } else if (/^[0-9]{4}-[0-9]{4}$/.test(data[1])) {
            applyDate = data[1].split('-');
          } else if (/^[0-9]{4}$/.test(data[1])) {
            applyDate = [data[1], data[1]];
          } else {
            continue;
          }
          date = date.join('-');
          vm.newInfo.push({
            date: date,
            isAlways: isAlways,
            startYear: applyDate[0],
            endYear: applyDate[1],
            content: data[2],
          });
        }
      }
    };
  };

  function getAttribute() {
    return attributeService.getEntityAttributes(entityId, 'SERVER_SCOPE', ['plannedHoliday']);
  }

  function saveAttribute(datas) {
    let originData = [];
    if (datas && datas[0]) {
      originData = datas[0].value;
    }

    for (let i in vm.newInfo) {
      let targetIndex = originData.findIndex(x => x.date == vm.newInfo[i].date);
      if (targetIndex != -1) {
        originData[targetIndex] = vm.newInfo[i];
      } else {
        originData.push(vm.newInfo[i]);
      }
    }

    return attributeService.saveEntityAttributes(entityId, 'SERVER_SCOPE', [
      {
        key: 'plannedHoliday',
        value: originData,
      },
    ]);
  }
}
