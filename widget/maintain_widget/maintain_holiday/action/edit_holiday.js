let $injector = widgetContext.$scope.$injector;
let customDialog = $injector.get(widgetContext.servicesMap.get('customDialog'));
let userService = $injector.get(widgetContext.servicesMap.get('userService'));
let entityRelationService = $injector.get(widgetContext.servicesMap.get('entityRelationService'));
let attributeService = $injector.get(widgetContext.servicesMap.get('attributeService'));

const t = widgetContext.custom.t;

openEditEntityDialog();

function openEditEntityDialog() {
  customDialog.customDialog(htmlTemplate, EditEntityDialogController).subscribe();
}

function EditEntityDialogController(instance) {
  let vm = instance;
  vm.ownerId = widgetContext.defaultSubscription.configuredDatasources[0].entity.id;
  vm.ownerLevel = widgetContext.$scope.ownerLevel;
  vm.t = t;
  let month = additionalParams.date.split('-')[0];
  let date = additionalParams.date.split('-')[1];
  let now = moment().toDate();
  let origin = moment()
    .month(month - 1)
    .date(date)
    .toDate();
  vm.nowYear = moment(now).year();
  vm.startYearList = [];
  vm.endYearList = [];
  let startYear = vm.nowYear;
  if (additionalParams.startYear) {
    startYear = Number(additionalParams.startYear);
  }
  let endYear = vm.nowYear;
  if (additionalParams.endYear) {
    endYear = Number(additionalParams.endYear);
  }

  for (let i = vm.nowYear; i <= endYear; i++) {
    vm.startYearList.push({ name: t('thingplus.time-format.year-value', { year: i }), value: i });
  }
  for (let i = startYear; i <= vm.nowYear + 100; i++) {
    vm.endYearList.push({ name: t('thingplus.time-format.year-value', { year: i }), value: i });
  }
  vm.targetDate = origin;
  vm.viewTargetDate = moment(origin).format('YYYY-MM-DD');
  vm.holiday = [];

  vm.editEntityFormGroup = vm.fb.group({
    targetDate: [origin],
    isAlways: [additionalParams.isAlways],
    startYear: [startYear],
    endYear: [endYear],
    content: [additionalParams.content],
  });

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
    vm.editEntityFormGroup.markAsPristine();
    loadAttribute().subscribe(datas => {
      if (datas && datas[0]) {
        vm.holiday = datas[0].value;
      }
      saveAttribute().subscribe(() => {
        widgetContext.updateAliases();
        vm.dialogRef.close(null);
      });
    });
  };

  vm.setIsAlways = function (e, value) {
    vm.editEntityFormGroup.patchValue(
      {
        isAlways: value,
      },
      { emitEvent: false }
    );
  };
  vm.setStartYear = function (e) {
    let endYear = vm.editEntityFormGroup.get('endYear').value;
    vm.endYearList = [];
    for (let i = e.value; i <= vm.nowYear + 100; i++) {
      vm.endYearList.push({ name: t('thingplus.time-format.year-value', { year: i }), value: i });
    }
    if (endYear < e.value) {
      vm.editEntityFormGroup.patchValue(
        {
          endYear: e.value,
        },
        { emitEvent: false }
      );
    }
  };
  vm.setEndYear = function (e) {
    let startYear = vm.editEntityFormGroup.get('startYear').value;
    vm.startYearList = [];
    for (let i = vm.nowYear; i <= e.value; i++) {
      vm.startYearList.push({ name: t('thingplus.time-format.year-value', { year: i }), value: i });
    }
    if (startYear > e.value) {
      vm.editEntityFormGroup.patchValue(
        {
          startYear: e.value,
        },
        { emitEvent: false }
      );
    }
  };
  vm.setTargetDate = function (e) {
    vm.editEntityFormGroup.patchValue(
      {
        targetDate: e,
      },
      { emitEvent: false }
    );
    vm.viewTargetDate = moment(e).format('YYYY-MM-DD');
  };

  function loadAttribute() {
    let entityId = widgetContext.custom.ownerDatasource.entity.id;
    return widgetContext.attributeService.getEntityAttributes(entityId, 'SERVER_SCOPE', ['plannedHoliday']);
  }

  function saveAttribute() {
    let entityId = widgetContext.custom.ownerDatasource.entity.id;
    let targetDate = vm.editEntityFormGroup.get('targetDate').value;
    let isAlways = vm.editEntityFormGroup.get('isAlways').value;
    let startYear = vm.editEntityFormGroup.get('startYear').value;
    let endYear = vm.editEntityFormGroup.get('endYear').value;
    let content = vm.editEntityFormGroup.get('content').value;

    if (isAlways) {
      startYear = '';
      endYear = '';
    }

    let newHoliday = {
      date: moment(targetDate).format('MM-DD'),
      isAlways: isAlways,
      startYear: startYear,
      endYear: endYear,
      content: content,
    };
    let targetIndex = vm.holiday.findIndex(item => item.date == additionalParams.date);
    if (targetIndex != -1) {
      vm.holiday.splice(targetIndex, 1);
    }
    targetIndex = vm.holiday.findIndex(item => item.date == newHoliday.date);
    if (targetIndex != -1) {
      vm.holiday.splice(targetIndex, 1);
    }
    vm.holiday.push(newHoliday);
    vm.holiday.sort((a, b) => {
      return a.date > b.date ? 1 : -1;
    });
    let attributeBody = [{ key: 'plannedHoliday', value: vm.holiday }];
    return attributeService.saveEntityAttributes(entityId, 'SERVER_SCOPE', attributeBody);
  }
}
