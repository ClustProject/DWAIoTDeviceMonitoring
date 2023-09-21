let $injector = widgetContext.$scope.$injector;
let customDialog = $injector.get(widgetContext.servicesMap.get('customDialog'));
let attributeService = $injector.get(widgetContext.servicesMap.get('attributeService'));

const t = widgetContext.custom.t;
const DEFAULT_TIME = 8 * 3600000;

openEditEntityDialog();

function openEditEntityDialog() {
  customDialog.customDialog(htmlTemplate, EditEntityDialogController).subscribe();
}

function EditEntityDialogController(instance) {
  let vm = instance;
  vm.ownerId = widgetContext.defaultSubscription.configuredDatasources[0].entity.id;
  vm.ownerLevel = widgetContext.$scope.ownerLevel;
  vm.t = t;
  vm.type = additionalParams.type;

  vm.dayList = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  let plannedOperationTime = {
    isDivideByWeek: false,
    everyday: DEFAULT_TIME,
    week: [DEFAULT_TIME, DEFAULT_TIME, DEFAULT_TIME, DEFAULT_TIME, DEFAULT_TIME, DEFAULT_TIME, DEFAULT_TIME],
  };
  if (additionalParams.type == 'DEVICE') {
    let targetIndex = widgetContext.custom.commonInfo[additionalParams.index].findIndex(
      item => item.key == 'plannedOperationTime'
    );
    if (targetIndex != -1) {
      plannedOperationTime = _.cloneDeep(widgetContext.custom.commonInfo[additionalParams.index][targetIndex].value);
    }
  }
  vm.divideWeek = plannedOperationTime.isDivideByWeek;
  plannedOperationTime.everyday = toDate(plannedOperationTime.everyday);
  for (let i in plannedOperationTime.week) {
    plannedOperationTime.week[i] = toDate(plannedOperationTime.week[i]);
  }
  vm.editEntityFormGroup = vm.fb.group({
    label: [entityLabel],
    plannedOperationTime: vm.fb.group({
      everydayHour: [plannedOperationTime.everyday[0]],
      everydayMin: [plannedOperationTime.everyday[1]],
      week: vm.fb.array([
        vm.fb.group({ hour: [plannedOperationTime.week[0][0]], min: [plannedOperationTime.week[0][1]] }),
        vm.fb.group({ hour: [plannedOperationTime.week[1][0]], min: [plannedOperationTime.week[1][1]] }),
        vm.fb.group({ hour: [plannedOperationTime.week[2][0]], min: [plannedOperationTime.week[2][1]] }),
        vm.fb.group({ hour: [plannedOperationTime.week[3][0]], min: [plannedOperationTime.week[3][1]] }),
        vm.fb.group({ hour: [plannedOperationTime.week[4][0]], min: [plannedOperationTime.week[4][1]] }),
        vm.fb.group({ hour: [plannedOperationTime.week[5][0]], min: [plannedOperationTime.week[5][1]] }),
        vm.fb.group({ hour: [plannedOperationTime.week[6][0]], min: [plannedOperationTime.week[6][1]] }),
      ]),
    }),
  });

  vm.getWeek = function () {
    return this.editEntityFormGroup.get('plannedOperationTime').controls['week'];
  };
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
  vm.save = function () {
    vm.editEntityFormGroup.markAsPristine();
    saveAttribute().subscribe(() => {
      widgetContext.updateAliases();
      vm.dialogRef.close(null);
    });
  };

  function saveAttribute() {
    let plannedOperationTime = vm.editEntityFormGroup.get('plannedOperationTime').value;
    plannedOperationTime.isDivideByWeek = vm.divideWeek;
    plannedOperationTime.everyday = getTime(plannedOperationTime.everydayHour, plannedOperationTime.everydayMin);
    delete plannedOperationTime.everydayHour;
    delete plannedOperationTime.everydayMin;
    for (let i in plannedOperationTime.week) {
      plannedOperationTime.week[i] = getTime(plannedOperationTime.week[i].hour, plannedOperationTime.week[i].min);
    }

    let observables = [];
    let attributeBody = [
      { key: 'plannedOperationTime', value: plannedOperationTime },
      { key: 'plannedCustom', value: {} },
    ];

    if (additionalParams.type == 'CUSTOMER') {
      let entityList = additionalParams.child.map(x => x.id);
      for (let i in entityList) {
        observables.push(attributeService.saveEntityAttributes(entityList[i], 'SERVER_SCOPE', attributeBody));
      }
    } else {
      observables.push(attributeService.saveEntityAttributes(entityId, 'SERVER_SCOPE', attributeBody));
    }

    return widgetContext.rxjs.forkJoin(observables);
  }
  function getTime(hour, min) {
    let result = hour * 3600000 + min * 60000;
    if (result > 86400000) {
      result = 86400000;
    }
    return result;
  }
  function toDate(value) {
    if (isNaN(Number(value))) return [8, 0];
    if (value > 86400000) {
      value = 86400000;
    }
    let hour = Math.floor(value / 3600000);
    let temp = value % 3600000;
    let min = Math.floor(temp / 60000);
    return [hour, min];
  }
}
