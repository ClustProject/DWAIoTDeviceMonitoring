let $injector = widgetContext.$scope.$injector;
let customDialog = $injector.get(widgetContext.servicesMap.get('customDialog'));
let deviceService = $injector.get(widgetContext.servicesMap.get('deviceService'));
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
  vm.pushAlarmConfig = JSON.parse(additionalParams.TP_PUSH_ALARM_CONFIG);
  let alarmType = {};
  for (let i in vm.pushAlarmConfig.typeList) {
    alarmType[vm.pushAlarmConfig.typeList[i]] = true;
  }
  vm.snooze = vm.pushAlarmConfig.reAlarmMs != undefined;

  vm.editEntityFormGroup = vm.fb.group({
    reAlarmMs: [Math.floor(vm.pushAlarmConfig.reAlarmMs / 3600000) || 24],
    deviceState: vm.fb.group({
      delayed: [alarmType.delayed || false],
      unconnected: [alarmType.unconnected || false],
    }),
    electricQuality: vm.fb.group({
      'over-current': [alarmType['over-current'] || false],
      'low-voltage': [alarmType['low-voltage'] || false],
      'high-voltage': [alarmType['high-voltage'] || false],
      'volt-imbalance': [alarmType['volt-imbalance'] || false],
      'curr-imbalance': [alarmType['curr-imbalance'] || false],
      thd: [alarmType['thd'] || false],
      'power-factor': [alarmType['power-factor'] || false],
    }),
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
}
