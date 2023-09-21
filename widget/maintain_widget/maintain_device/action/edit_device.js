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
  vm.customerL1List = [{ name: t('thingplus.selector.select-customerL1'), value: '' }];
  vm.customerL2List = [{ name: t('thingplus.selector.select-customerL2'), value: '' }];
  vm.userList = [{ name: t('thingplus.selector.select-manager'), value: '', phone: '-' }];
  vm.selectedPhone = '-';
  if (vm.ownerLevel == 0) {
    vm.customerL1List = vm.customerL1List.concat(
      widgetContext.custom.customerL1List
        .map(x => {
          return {
            name: x.name,
            value: x.id.id,
          };
        })
        .sort((a, b) => {
          if (a.name > b.name) return 1;
          if (a.name < b.name) return -1;
          return 0;
        })
    );
  }
  if (vm.ownerLevel <= 1) {
    vm.customerL2List = vm.customerL2List.concat(
      widgetContext.custom.customerL2List
        .map(x => {
          return {
            name: x.name,
            value: x.id.id,
          };
        })
        .sort((a, b) => {
          if (a.name > b.name) return 1;
          if (a.name < b.name) return -1;
          return 0;
        })
    );
  }
  vm.userList = vm.userList.concat(
    widgetContext.custom.userList
      .map(x => {
        return {
          name: x.details.firstName,
          value: x.id.id,
          phone: x.details.additionalInfo && x.details.additionalInfo.phone ? x.details.additionalInfo.phone : '-',
          email: x.details.email,
        };
      })
      .sort((a, b) => {
        if (a.name > b.name) return 1;
        if (a.name < b.name) return -1;
        return 0;
      })
  );

  vm.modelList = [
    { name: t('thingplus.selector.model-selection'), value: '' },
    { name: t('thingplus.device-model.YMC-430.summary'), value: 'YMC-430' },
    { name: t('thingplus.device-model.M2-5AX_20K.summary'), value: 'M2-5AX_20K' },
    { name: t('thingplus.device-model.YBM-1218V.summary'), value: 'YBM-1218V' },
    { name: t('thingplus.device-model.RB-5M.summary'), value: 'RB-5M' },
    { name: t('thingplus.device-model.WINSTAR-SP.summary'), value: 'WINSTAR-SP' },
    { name: t('thingplus.device-model.UJG-35.summary'), value: 'UJG-35' },
    { name: t('thingplus.device-model.AP450L.summary'), value: 'AP450L' },
    { name: t('thingplus.device-model.AQ1200L.summary'), value: 'AQ1200L' },
    { name: t('thingplus.device-model.AP3L.summary'), value: 'AP3L' },
    { name: t('thingplus.device-model.AG100L.summary'), value: 'AG100L' },
    { name: t('thingplus.device-model.TRULASER_CELL_7040.summary'), value: 'TRULASER_CELL_7040' },
    { name: t('thingplus.device-model.BC-3020_DYNAMIC.summary'), value: 'BC-3020_DYNAMIC' },
    { name: t('thingplus.device-model.GLS-150GL.summary'), value: 'GLS-150GL' },
    { name: t('thingplus.device-model.DE4P-2500.summary'), value: 'DE4P-2500' },
    { name: t('thingplus.device-model.DE4P-2000.summary'), value: 'DE4P-2000' },
    { name: t('thingplus.device-model.DE2P-1200.summary'), value: 'DE2P-1200' },
    { name: t('thingplus.device-model.AUH-125H.summary'), value: 'AUH-125H' },
    { name: t('thingplus.device-model.ACCURA-II.summary'), value: 'ACCURA-II' },
    { name: t('thingplus.device-model.CRYSTA-APEX_S_122010.summary'), value: 'CRYSTA-APEX_S_122010' },
    { name: t('thingplus.device-model.LHM-V2.summary'), value: 'LHM-V2' },
  ];

  vm.currentStep = 0;
  vm.originCustomerL2 = widgetContext.custom.relations[entityId.id].parent.id.id;
  vm.originUser = additionalParams.user || '';
  if (vm.userList.findIndex(x => x.value == vm.originUser) == -1) {
    vm.originUser = '';
  }
  let targetIndex = vm.userList.findIndex(x => x.value == vm.originUser);
  if (targetIndex != -1) {
    vm.selectedPhone = vm.userList[targetIndex].phone;
  }
  vm.dayList = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  let plannedOperationTime = {};
  if (additionalParams.plannedOperationTime) {
    plannedOperationTime = JSON.parse(additionalParams.plannedOperationTime);
  }
  vm.divideWeek = plannedOperationTime.isDivideByWeek;
  plannedOperationTime.everyday = toDate(plannedOperationTime.everyday);
  for (let i in plannedOperationTime.week) {
    plannedOperationTime.week[i] = toDate(plannedOperationTime.week[i]);
  }
  let trialConfig = {};
  if (additionalParams.trialConfig) {
    trialConfig = JSON.parse(additionalParams.trialConfig);
  }
  vm.isActiveTrial = trialConfig.isActive;
  let electricLimit = {};
  if (additionalParams.electricLimit) {
    electricLimit = JSON.parse(additionalParams.electricLimit);
  }
  vm.noWorkState = additionalParams.noWorkState || 'STOP';
  vm.originWaitPowerLimit = additionalParams.TP_WaitPowerLimit;
  vm.originWorkPowerLimit = additionalParams.TP_WorkPowerLimit;
  vm.editEntityFormGroup = vm.fb.group({
    customerL1Name: [additionalParams.customerL1Name],
    customerL2Name: [additionalParams.customerL2Name],
    name: [entityName],
    label: [entityLabel, [vm.validators.required, vm.validators.maxLength(24)]],
    model: [additionalParams.model],
    user: [additionalParams.user || ''],
    stopPower: [additionalParams.stopPower || 0, [vm.validators.required]],
    waitPowerLimit: [additionalParams.TP_WaitPowerLimit || 50, [vm.validators.required]],
    workPowerLimit: [additionalParams.TP_WorkPowerLimit || 300, [vm.validators.required]],
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
    trialConfig: vm.fb.group({
      isActive: [trialConfig.isActive || false],
      trialMin: [trialConfig.trialMin || 20],
      trialMax: [trialConfig.trialMax || 40],
    }),
    electricLimit: vm.fb.group({
      voltHigh: [electricLimit.voltHigh],
      voltLow: [electricLimit.voltLow],
      curr: [electricLimit.curr],
      voltImbal: [electricLimit.voltImbal],
      currImbal: [electricLimit.currImbal],
      pf: [electricLimit.pf],
      thd: [electricLimit.thd],
    }),
  });

  if (vm.ownerLevel == 0) {
    vm.editEntityFormGroup.controls.customerL1 = vm.fb.control(
      widgetContext.custom.relations[entityId.id].parent.parent.id.id
    );
  }
  if (vm.ownerLevel <= 1) {
    widgetContext.custom.relations[entityId.id].parent.id.id;
    vm.editEntityFormGroup.controls.customerL2 = vm.fb.control(
      widgetContext.custom.relations[entityId.id].parent.id.id,
      [vm.validators.required]
    );
  }
  getDevice(entityId.id).subscribe(device => {
    vm.originDevice = device;
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
    let customerL2Id = vm.editEntityFormGroup.get('customerL2').value || entityId.id;
    let userId = vm.editEntityFormGroup.get('user').value;
    vm.isRelationChange = false;
    if (vm.originCustomerL2 != customerL2Id) {
      vm.isRelationChange = true;
    }
    vm.isManagerChange = false;
    if (vm.originUser != userId) {
      vm.isManagerChange = true;
    }
    saveDevice().subscribe(device => {
      let taskList = [saveAttribute(device), saveTelemetry(device)];
      if (vm.isRelationChange) {
        taskList.push(
          entityRelationService.deleteRelation(
            { entityType: 'CUSTOMER', id: vm.originCustomerL2 },
            'Contains',
            device.id
          )
        );
        taskList.push(
          entityRelationService.saveRelation({
            from: {
              entityType: 'CUSTOMER',
              id: customerL2Id,
            },
            to: device.id,
            type: 'Contains',
          })
        );
      }
      if (vm.isManagerChange) {
        if (vm.originUser && vm.originUser != '') {
          taskList.push(
            entityRelationService.deleteRelation({ entityType: 'USER', id: vm.originUser }, 'Manages', device.id, {
              ignoreErrors: true,
            })
          );
        }
        if (userId != '') {
          taskList.push(
            entityRelationService.saveRelation({
              from: {
                entityType: 'USER',
                id: userId,
              },
              to: device.id,
              type: 'Manages',
            })
          );
        }
      }

      widgetContext.rxjs.forkJoin(taskList).subscribe(() => {
        if (vm.isRelationChange) {
          reassign(device);
        } else {
          widgetContext.updateAliases();
          vm.dialogRef.close(null);
        }
      });
    });
  };
  vm.selectStep = function (e, index) {
    console.log(vm.editEntityFormGroup);
    if (vm.editEntityFormGroup.invalid) return;
    vm.currentStep = index;
  };
  vm.prevStep = function () {
    vm.currentStep--;
  };
  vm.nextStep = function () {
    vm.currentStep++;
  };
  vm.setCustomerL1 = function (e) {
    let customerL1 = vm.editEntityFormGroup.get('customerL1').value;
    vm.customerL2List = [{ name: t('thingplus.selector.select-customerL2'), value: '' }];
    vm.editEntityFormGroup.patchValue(
      {
        customerL2: '',
      },
      { emitEvent: false }
    );
    vm.customerL2List = vm.customerL2List.concat(
      widgetContext.custom.customerL2List
        .filter(x => {
          return customerL1 == '' || x.parent.id.id == customerL1;
        })
        .map(x => {
          return {
            name: x.name,
            value: x.id.id,
          };
        })
        .sort((a, b) => {
          if (a.name > b.name) return 1;
          if (a.name < b.name) return -1;
          return 0;
        })
    );
  };
  vm.setUser = function (e) {
    let targetIndex = vm.userList.findIndex(x => x.value == e.value);
    if (targetIndex != -1) {
      vm.selectedPhone = vm.userList[targetIndex].phone;
    }
  };

  function getDevice(deviceId) {
    return deviceService.getDevice(deviceId);
  }

  function saveDevice() {
    let label = vm.editEntityFormGroup.get('label').value;

    if (_.isNil(vm.originDevice)) return;
    vm.originDevice.label = label;
    return deviceService.saveDevice(vm.originDevice);
  }

  function reassign(device) {
    return deviceService.unassignDeviceFromCustomer(device.id.id).subscribe(() => {
      let customerL2Id = vm.editEntityFormGroup.get('customerL2').value || entityId.id;
      deviceService.assignDeviceToCustomer(customerL2Id, device.id.id).subscribe(() => {
        widgetContext.updateAliases();
        vm.dialogRef.close(null);
      });
    });
  }

  function saveAttribute(device) {
    let customerL2Id = vm.editEntityFormGroup.get('customerL2').value || entityId.id;
    let customerL2 = widgetContext.custom.relations[customerL2Id];
    let customerL1Name = customerL2.parent.name;
    let customerL2Name = customerL2.name;
    let model = vm.editEntityFormGroup.get('model').value;
    let user = vm.editEntityFormGroup.get('user').value;
    let userIndex = vm.userList.findIndex(x => x.value == user);
    let phone = vm.userList[userIndex].phone;
    let manager = vm.userList[userIndex].name;
    let email = vm.userList[userIndex].email;

    let plannedOperationTime = vm.editEntityFormGroup.get('plannedOperationTime').value;
    plannedOperationTime.isDivideByWeek = vm.divideWeek;
    plannedOperationTime.everyday = getTime(plannedOperationTime.everydayHour, plannedOperationTime.everydayMin);
    for (let i in plannedOperationTime.week) {
      plannedOperationTime.week[i] = getTime(plannedOperationTime.week[i].hour, plannedOperationTime.week[i].min);
    }
    let trialConfig = vm.editEntityFormGroup.get('trialConfig').value;
    trialConfig.isActive = vm.isActiveTrial;

    let stopPower = vm.editEntityFormGroup.get('stopPower').value;
    let electricLimit = vm.editEntityFormGroup.get('electricLimit').value;

    let attributeBody = [
      { key: 'customerL1Name', value: customerL1Name },
      { key: 'customerL2Name', value: customerL2Name },
      { key: 'model', value: model },
      { key: 'user', value: user },
      { key: 'plannedOperationTime', value: plannedOperationTime },
      { key: 'trialConfig', value: trialConfig },
      { key: 'noWorkState', value: vm.noWorkState },
      { key: 'stopPower', value: stopPower },
      { key: 'electricLimit', value: electricLimit },
      { key: 'phone', value: phone },
      { key: 'manager', value: manager },
      { key: 'email', value: email },
    ];
    return attributeService.saveEntityAttributes(device.id, 'SERVER_SCOPE', attributeBody);
  }
  function saveTelemetry(device) {
    let waitPowerLimit = vm.editEntityFormGroup.get('waitPowerLimit').value;
    let workPowerLimit = vm.editEntityFormGroup.get('workPowerLimit').value;

    let telemetryBody = [];
    if (vm.originWaitPowerLimit != waitPowerLimit) {
      telemetryBody.push({ key: 'TP_WaitPowerLimit', value: waitPowerLimit });
    }
    if (vm.originWorkPowerLimit != workPowerLimit) {
      telemetryBody.push({ key: 'TP_WorkPowerLimit', value: workPowerLimit });
    }
    return attributeService.saveEntityTimeseries(device.id, 'TELEMETRY', telemetryBody);
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
