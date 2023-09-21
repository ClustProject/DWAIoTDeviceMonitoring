let $injector = widgetContext.$scope.$injector;
let customDialog = $injector.get(widgetContext.servicesMap.get('customDialog'));

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

  let typeList = {};
  let originTypeList = JSON.parse(additionalParams.typeList);
  for (let i in originTypeList) {
    typeList[originTypeList[i]] = true;
  }

  if (additionalParams.receiver) {
    let originReceiver = additionalParams.receiver.split(',');
    vm.smsList = vm.userList
      .filter(x => originReceiver.includes(x.phone))
      .map(x => {
        return { name: x.name, value: x.phone };
      });
    vm.smsList = vm.smsList.concat(
      originReceiver
        .filter(x => !vm.userList.map(y => y.phone).includes(x))
        .map(x => {
          return { value: x };
        })
    );
  }
  let customerL2Index = vm.customerL2List.findIndex(x => x.value == additionalParams.customerL2);
  let customerL2Name = customerL2Index > -1 ? vm.customerL2List[customerL2Index].name : '';
  let deviceIndex = vm.deviceList.findIndex(x => x.value == additionalParams.device);
  let deviceName = deviceIndex > -1 ? vm.deviceList[deviceIndex].name : '';
  vm.detailEntityFormGroup = vm.fb.group({
    title: [additionalParams.title, [vm.validators.required]],
    customerL2Name: [customerL2Name],
    device: [deviceName],
    deviceState: vm.fb.group({
      delayed: [typeList.delayed],
      unconnected: [typeList.unconnected],
    }),
    electricQuality: vm.fb.group({
      'over-current': [typeList['over-current']],
      'low-voltage': [typeList['low-voltage']],
      'high-voltage': [typeList['high-voltage']],
      'volt-imbalance': [typeList['volt-imbalance']],
      'curr-imbalance': [typeList['curr-imbalance']],
      thd: [typeList.thd],
      'power-factor': [typeList['power-factor']],
    }),
  });
  if (vm.ownerLevel <= 1) {
    vm.detailEntityFormGroup.controls.customerL2 = vm.fb.control(additionalParams.customerL2);
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
}
