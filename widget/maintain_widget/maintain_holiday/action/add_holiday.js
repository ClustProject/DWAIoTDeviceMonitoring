let $injector = widgetContext.$scope.$injector;
let customDialog = $injector.get(widgetContext.servicesMap.get('customDialog'));
let userService = $injector.get(widgetContext.servicesMap.get('userService'));
let entityRelationService = $injector.get(widgetContext.servicesMap.get('entityRelationService'));
let attributeService = $injector.get(widgetContext.servicesMap.get('attributeService'));

const t = widgetContext.custom.t;

openAddEntityDialog();

function openAddEntityDialog() {
  customDialog.customDialog(htmlTemplate, AddEntityDialogController).subscribe();
}

function AddEntityDialogController(instance) {
  let vm = instance;
  vm.ownerId = widgetContext.defaultSubscription.configuredDatasources[0].entity.id;
  vm.ownerLevel = widgetContext.$scope.ownerLevel;
  vm.t = t;
  let now = moment().toDate();
  vm.nowYear = moment(now).year();
  vm.startYearList = [];
  vm.endYearList = [];
  for (let i = vm.nowYear; i < vm.nowYear + 100; i++) {
    vm.startYearList.push({ name: t('thingplus.time-format.year-value', { year: i }), value: i });
    vm.endYearList.push({ name: t('thingplus.time-format.year-value', { year: i }), value: i });
  }
  vm.targetDate = now;
  vm.viewTargetDate = moment(now).format('YYYY-MM-DD');
  vm.holiday = [];

  vm.addEntityFormGroup = vm.fb.group({
    targetDate: [now],
    isAlways: [true],
    startYear: [vm.nowYear],
    endYear: [vm.nowYear],
    content: [''],
  });

  loadAttribute();

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
    vm.addEntityFormGroup.patchValue(
      {
        isAlways: value,
      },
      { emitEvent: false }
    );
  };
  vm.setStartYear = function (e) {
    let endYear = vm.addEntityFormGroup.get('endYear').value;
    vm.endYearList = [];
    for (let i = e.value; i <= vm.nowYear + 100; i++) {
      vm.endYearList.push({ name: t('thingplus.time-format.year-value', { year: i }), value: i });
    }
    if (endYear < e.value) {
      vm.addEntityFormGroup.patchValue(
        {
          endYear: e.value,
        },
        { emitEvent: false }
      );
    }
  };
  vm.setEndYear = function (e) {
    let startYear = vm.addEntityFormGroup.get('startYear').value;
    vm.startYearList = [];
    for (let i = vm.nowYear; i <= e.value; i++) {
      vm.startYearList.push({ name: t('thingplus.time-format.year-value', { year: i }), value: i });
    }
    if (startYear > e.value) {
      vm.addEntityFormGroup.patchValue(
        {
          startYear: e.value,
        },
        { emitEvent: false }
      );
    }
  };
  vm.setTargetDate = function (e) {
    vm.addEntityFormGroup.patchValue(
      {
        targetDate: e,
      },
      { emitEvent: false }
    );
    vm.viewTargetDate = moment(e).format('YYYY-MM-DD');
  };

  function loadAttribute() {
    return widgetContext.attributeService.getEntityAttributes(entityId, 'SERVER_SCOPE', ['plannedHoliday']);
  }

  function saveAttribute() {
    let targetDate = vm.addEntityFormGroup.get('targetDate').value;
    let isAlways = vm.addEntityFormGroup.get('isAlways').value;
    let startYear = vm.addEntityFormGroup.get('startYear').value;
    let endYear = vm.addEntityFormGroup.get('endYear').value;
    let content = vm.addEntityFormGroup.get('content').value;

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
    let targetIndex = vm.holiday.findIndex(item => item.date == newHoliday.date);
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
