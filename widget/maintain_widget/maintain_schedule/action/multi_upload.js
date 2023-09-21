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
  vm.newInfo = {};

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
          let data = [rows[i].split('"')[1]];
          data = data.concat(rows[i].split('"')[2].split(',').slice(1));
          let targetIndex = widgetContext.custom.deviceList.findIndex(x => x.label == data[0]);
          if (targetIndex != -1) {
            if (!vm.newInfo[widgetContext.custom.deviceList[targetIndex].id.id]) {
              vm.newInfo[widgetContext.custom.deviceList[targetIndex].id.id] = {};
            }
            if (moment(data[1]).startOf('day').valueOf() >= moment().startOf('day').valueOf()) {
              vm.newInfo[widgetContext.custom.deviceList[targetIndex].id.id][moment(data[1]).startOf('day').valueOf()] =
                data[2] * HOUR_MS + data[3] * MINUTE_MS;
            }
          }
        }
      }
    };
  };

  function getAttribute() {
    let observables = [];
    for (let i in vm.newInfo) {
      observables.push(
        attributeService.getEntityAttributes(
          {
            entityType: 'DEVICE',
            id: i,
          },
          'SERVER_SCOPE',
          ['plannedCustom']
        )
      );
    }
    return widgetContext.rxjs.forkJoin(observables);
  }

  function saveAttribute(datas) {
    let observables = [];
    let keys = Object.keys(vm.newInfo);

    for (let i in keys) {
      if (datas && datas[i] && datas[i][0] && datas[i][0].value) {
        vm.newInfo[keys[i]] = _.merge(datas[i][0].value, vm.newInfo[keys[i]], true);
      }
    }

    for (let i in vm.newInfo) {
      observables.push(
        attributeService.saveEntityAttributes({ entityType: 'DEVICE', id: i }, 'SERVER_SCOPE', [
          {
            key: 'plannedCustom',
            value: vm.newInfo[i],
          },
        ])
      );
    }
    return widgetContext.rxjs.forkJoin(observables);
  }
}
