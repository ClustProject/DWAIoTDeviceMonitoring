let $injector = widgetContext.$scope.$injector;
let customDialog = $injector.get(widgetContext.servicesMap.get('customDialog'));
let deviceService = $injector.get(widgetContext.servicesMap.get('deviceService'));
let entityRelationService = $injector.get(widgetContext.servicesMap.get('entityRelationService'));
let attributeService = $injector.get(widgetContext.servicesMap.get('attributeService'));

const JWT_TOKEN = window.localStorage.getItem('jwt_token');
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
  let defaultCustomerL1Name = widgetContext.custom.relations[entityId.id].parent
    ? widgetContext.custom.relations[entityId.id].parent.name
    : entityName;
  vm.originUser = additionalParams.user || '';
  if (vm.userList.findIndex(x => x.value == vm.originUser) == -1) {
    vm.originUser = '';
  }
  let targetIndex = vm.userList.findIndex(x => x.value == vm.originUser);
  if (targetIndex != -1) {
    vm.selectedPhone = vm.userList[targetIndex].phone;
  }
  vm.dayList = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  vm.divideWeek = false;
  vm.isActiveTrial = false;
  vm.noWorkState = 'STOP';
  vm.addEntityFormGroup = vm.fb.group({
    customerL1Name: [defaultCustomerL1Name],
    customerL2Name: [entityName],
    name: ['a1b2c3d4e5f6', [vm.validators.required, vm.validators.pattern(/^[a-z0-9-_]{4,64}$/)]],
    label: [t('thingplus.label.device') + ' A', [vm.validators.required, vm.validators.maxLength(16)]],
    model: ['', [vm.validators.required]],
    user: [''],
    stopPower: [0, [vm.validators.required]],
    waitPowerLimit: [50, [vm.validators.required]],
    workPowerLimit: [300, [vm.validators.required]],
    plannedOperationTime: vm.fb.group({
      everydayHour: [8],
      everydayMin: [0],
      week: vm.fb.array([
        vm.fb.group({ hour: [8], min: [0] }),
        vm.fb.group({ hour: [8], min: [0] }),
        vm.fb.group({ hour: [8], min: [0] }),
        vm.fb.group({ hour: [8], min: [0] }),
        vm.fb.group({ hour: [8], min: [0] }),
        vm.fb.group({ hour: [8], min: [0] }),
        vm.fb.group({ hour: [8], min: [0] }),
      ]),
    }),
    trialConfig: vm.fb.group({
      isActive: [false],
      trialMin: [20],
      trialMax: [40],
    }),
    electricLimit: vm.fb.group({
      voltHigh: [],
      voltLow: [],
      curr: [],
      voltImbal: [],
      currImbal: [],
      pf: [],
      thd: [],
    }),
  });

  if (vm.ownerLevel == 0) {
    vm.addEntityFormGroup.controls.customerL1 = vm.fb.control('');
  }
  if (vm.ownerLevel <= 1) {
    vm.addEntityFormGroup.controls.customerL2 = vm.fb.control('', [vm.validators.required]);
  }
  vm.getWeek = function () {
    return this.addEntityFormGroup.get('plannedOperationTime').controls['week'];
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
    vm.addEntityFormGroup.markAsPristine();
    registerDevice().subscribe(device => {
      device = device.tpngDevice; // Test라면 주석처리
      let taskList = [assignDevice(device), saveRelation(device), saveAttribute(device), saveTelemetry(device)];
      let user = vm.addEntityFormGroup.get('user').value;
      if (user != '') {
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
      widgetContext.rxjs.forkJoin(taskList).subscribe(() => {
        widgetContext.updateAliases();
        vm.dialogRef.close(null);
      });
    });
  };
  vm.selectStep = function (e, index) {
    if (vm.addEntityFormGroup.invalid) return;
    vm.currentStep = index;
  };
  vm.prevStep = function () {
    vm.currentStep--;
  };
  vm.nextStep = function () {
    vm.currentStep++;
  };
  vm.setCustomerL1 = function (e) {
    let customerL1 = vm.addEntityFormGroup.get('customerL1').value;
    vm.customerL2List = [{ name: t('thingplus.selector.select-customerL2'), value: '' }];
    vm.addEntityFormGroup.patchValue(
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

  function registerDevice() {
    let name = vm.addEntityFormGroup.get('name').value;
    let label = vm.addEntityFormGroup.get('label').value;

    let body = {
      agentFlag: 1,
      serviceName: 'Moldmecca Service',
      vhostName: name,
      rmqUserName: 'milesight',
      tpngDevice: {
        name: name,
        type: 'device',
        label: label,
      },
    };
    const JWT_TOKEN = window.localStorage.getItem('jwt_token');
    let option = {
      headers: {
        'X-authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };
    return widgetContext.http.post('https://devicereg.thingplus.net/api/regdevice', body, option);
  }

  // 테스트용
  function registerDeviceTest() {
    let name = vm.addEntityFormGroup.get('name').value;
    let label = vm.addEntityFormGroup.get('label').value;

    let body = {
      name: name,
      type: 'device',
      label: label,
    };

    return deviceService.saveDevice(body);
  }

  function assignDevice(device) {
    let CustomerL2Id = vm.addEntityFormGroup.get('customerL2').value || entityId.id;

    return deviceService.assignDeviceToCustomer(CustomerL2Id, device.id.id);
  }

  function saveRelation(device) {
    let CustomerL2Id = vm.addEntityFormGroup.get('customerL2').value || entityId.id;
    let relationBody = {
      from: {
        entityType: 'CUSTOMER',
        id: CustomerL2Id,
      },
      to: device.id,
      type: 'Contains',
    };
    return entityRelationService.saveRelation(relationBody);
  }

  function saveAttribute(device) {
    let customerL2Id = vm.addEntityFormGroup.get('customerL2').value || entityId.id;
    let customerL2 = widgetContext.custom.relations[customerL2Id];
    let customerL1Name = customerL2.parent.name;
    let customerL2Name = customerL2.name;
    let model = vm.addEntityFormGroup.get('model').value;
    let user = vm.addEntityFormGroup.get('user').value;
    let userIndex = vm.userList.findIndex(x => x.value == user);
    let phone = vm.userList[userIndex].phone;
    let manager = vm.userList[userIndex].name;
    let email = vm.userList[userIndex].email;

    let plannedOperationTime = vm.addEntityFormGroup.get('plannedOperationTime').value;
    plannedOperationTime.isDivideByWeek = vm.divideWeek;
    plannedOperationTime.everyday = getTime(plannedOperationTime.everydayHour, plannedOperationTime.everydayMin);
    for (let i in plannedOperationTime.week) {
      plannedOperationTime.week[i] = getTime(plannedOperationTime.week[i].hour, plannedOperationTime.week[i].min);
    }
    let trialConfig = vm.addEntityFormGroup.get('trialConfig').value;
    trialConfig.isActive = vm.isActiveTrial;

    let stopPower = vm.addEntityFormGroup.get('stopPower').value;

    let electricLimit = vm.addEntityFormGroup.get('electricLimit').value;

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
    let waitPowerLimit = vm.addEntityFormGroup.get('waitPowerLimit').value;
    let workPowerLimit = vm.addEntityFormGroup.get('workPowerLimit').value;
    let telemetryBody = [
      { key: 'TP_ActivationState', value: true },
      { key: 'TP_WaitPowerLimit', value: waitPowerLimit },
      { key: 'TP_WorkPowerLimit', value: workPowerLimit },
    ];
    return attributeService.saveEntityTimeseries(device.id, 'TELEMETRY', telemetryBody);
  }
  function getTime(hour, min) {
    let result = hour * 3600000 + min * 60000;
    if (result > 86400000) {
      result = 86400000;
    }
    return result;
  }
}
