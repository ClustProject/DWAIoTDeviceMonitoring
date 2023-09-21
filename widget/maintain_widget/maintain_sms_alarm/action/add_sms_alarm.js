let $injector = widgetContext.$scope.$injector;
let customDialog = $injector.get(widgetContext.servicesMap.get('customDialog'));
let assetService = $injector.get(widgetContext.servicesMap.get('assetService'));
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
  vm.currentStep = 0;
  vm.newSms = '';
  vm.smsList = [];
  vm.customerL2List = [{ name: t('thingplus.selector.entire-customerL2'), value: '' }];
  vm.deviceList = [{ name: t('thingplus.selector.entire-device'), value: '' }];
  vm.userList = [{ name: t('thingplus.selector.select-all'), value: 'ENTIRE', phone: '' }];

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
  vm.deviceList = vm.deviceList.concat(
    widgetContext.custom.deviceList
      .map(x => {
        return {
          name: x.label,
          value: x.id.id,
        };
      })
      .sort((a, b) => {
        if (a.name > b.name) return 1;
        if (a.name < b.name) return -1;
        return 0;
      })
  );
  vm.userList = vm.userList.concat(
    widgetContext.custom.userList
      .map(x => {
        return {
          name: x.details.firstName,
          value: x.id.id,
          phone: x.details.additionalInfo && x.details.additionalInfo.phone ? x.details.additionalInfo.phone : '-',
        };
      })
      .filter(x => x.phone !== '-')
      .sort((a, b) => {
        if (a.name > b.name) return 1;
        if (a.name < b.name) return -1;
        return 0;
      })
  );
  vm.originUsers = [];
  vm.addEntityFormGroup = vm.fb.group({
    title: ['', [vm.validators.required]],
    customerL2Name: [entityName],
    device: [''],
    deviceState: vm.fb.group({
      delayed: [false],
      unconnected: [false],
    }),
    electricQuality: vm.fb.group({
      'over-current': [false],
      'low-voltage': [false],
      'high-voltage': [false],
      'volt-imbalance': [false],
      'curr-imbalance': [false],
      thd: [false],
      'power-factor': [false],
    }),
    user: [vm.originUsers],
    newSms: ['', [vm.validators.pattern(/^[0-9]{2,3}-[0-9]{3,4}-[0-9]{4}$/)]],
  });
  if (vm.ownerLevel <= 1) {
    vm.addEntityFormGroup.controls.customerL2 = vm.fb.control('');
  }

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
    let users = vm.addEntityFormGroup.get('user').value;
    if (vm.smsList.length == 0 && users.length == 0) {
      window.alert(t('thingplus.help.error-required-receiver'));
      return;
    }
    saveAsset().subscribe(asset => {
      widgetContext.rxjs
        .forkJoin([changeName(asset), assignAsset(asset), saveRelation(asset), saveAttribute(asset)])
        .subscribe(() => {
          widgetContext.updateAliases();
          vm.dialogRef.close(null);
        });
    });
  };
  vm.selectStep = function (e, index) {
    vm.currentStep = index;
  };
  vm.prevStep = function () {
    vm.currentStep--;
  };
  vm.nextStep = function () {
    vm.currentStep++;
  };
  vm.setCustomerL2 = function (e) {
    let customerL2 = vm.addEntityFormGroup.get('customerL2').value;
    vm.deviceList = [{ name: t('thingplus.selector.entire-device'), value: '' }];
    vm.addEntityFormGroup.patchValue(
      {
        device: '',
      },
      { emitEvent: false }
    );
    vm.deviceList = vm.deviceList.concat(
      widgetContext.custom.deviceList
        .filter(x => {
          return customerL2 == '' || x.parent.id.id == customerL2;
        })
        .map(x => {
          return {
            name: x.label,
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
    // 기존에 Entire이 선택되어 있던 경우
    let newValue = _.cloneDeep(e.value);
    if (vm.originUsers.includes('ENTIRE')) {
      // Entire가 빠진 경우 모두 선택 해제
      if (!e.value.includes('ENTIRE')) {
        newValue = [];
        // Entire가 아닌 요소가 빠진 경우 Entire 삭제
      } else if (e.value.length < vm.originUsers.length) {
        newValue = e.value.filter(x => x != 'ENTIRE');
      }
      // 기존에 Entire이 선택되어 있지 않은 경우
    } else {
      // Entire가 선택된 경우 모두 선택
      if (e.value.includes('ENTIRE')) {
        newValue = vm.userList.map(x => x.value);
      }
    }
    vm.addEntityFormGroup.patchValue(
      {
        user: newValue,
      },
      { emitEvent: false }
    );
    vm.originUsers = newValue;
  };
  vm.getUserLength = function () {
    let users = vm.addEntityFormGroup.get('user').value;
    if (users.includes('ENTIRE')) {
      return users.length - 1;
    }
    return users.length;
  };
  vm.checkEntire = function (e, target) {
    let control = vm.addEntityFormGroup.get(target).value;
    if (e.checked) {
      for (let i in control) {
        control[i] = true;
      }
    } else {
      for (let i in control) {
        control[i] = false;
      }
    }
    vm.addEntityFormGroup.get(target).patchValue(control, { emitEvent: false });
  };
  vm.addSms = function (e) {
    let newSms = vm.addEntityFormGroup.get('newSms');
    if (newSms.hasError('pattern')) return;
    if (newSms.value != '') {
      vm.smsList.push(newSms.value);
      vm.addEntityFormGroup.patchValue(
        {
          newSms: '',
        },
        { emitEvent: false }
      );
    }
  };
  vm.deleteSms = function (e, sms) {
    let targetIndex = vm.smsList.indexOf(sms);
    vm.smsList.splice(targetIndex, 1);
  };

  function saveAsset() {
    let name = moment().valueOf() + '-' + Math.floor(1000000000000 * Math.random());
    let body = {
      name: name,
      label: vm.addEntityFormGroup.get('title').value,
      type: 'alarm',
    };
    return assetService.saveAsset(body);
  }
  function changeName(asset) {
    asset.name = asset.id.id;
    return assetService.saveAsset(asset);
  }

  function assignAsset(asset) {
    if (vm.ownerLevel > 0) {
      return assetService.assignAssetToCustomer(entityId.id, asset.id.id);
    } else {
      return widgetContext.rxjs.of([]);
    }
  }

  function saveRelation(asset) {
    let relationBody = {
      from: entityId,
      to: asset.id,
      type: 'Alarms',
    };
    return entityRelationService.saveRelation(relationBody);
  }

  function saveAttribute(asset) {
    let customerL2Id = '';
    let deviceId = '';
    if (vm.ownerLevel <= 1) {
      customerL2Id = vm.addEntityFormGroup.get('customerL2').value;
      deviceId = vm.addEntityFormGroup.get('device').value;
    } else {
      customerL2Id = entityId.id;
      deviceId = vm.addEntityFormGroup.get('device').value;
    }
    let deviceState = vm.addEntityFormGroup.get('deviceState').value;
    let electricQuality = vm.addEntityFormGroup.get('electricQuality').value;
    let typeList = [];
    for (let i in deviceState) {
      if (deviceState[i]) {
        typeList.push(i);
      }
    }
    for (let i in electricQuality) {
      if (electricQuality[i]) {
        typeList.push(i);
      }
    }
    let users = vm.addEntityFormGroup.get('user').value;
    users = users.filter(x => x != 'ENTIRE');

    let smsList = vm.userList.filter(x => users.includes(x.value)).map(x => x.phone);
    smsList = smsList.concat(vm.smsList);
    smsList = _.uniq(smsList);

    let attributeBody = [
      { key: 'isEnable', value: true },
      { key: 'title', value: vm.addEntityFormGroup.get('title').value },
      { key: 'typeList', value: typeList },
      { key: 'customerL2', value: customerL2Id },
      { key: 'device', value: deviceId },
      { key: 'receiver', value: smsList.join(',') },
    ];
    return attributeService.saveEntityAttributes(asset.id, 'SERVER_SCOPE', attributeBody);
  }
}
