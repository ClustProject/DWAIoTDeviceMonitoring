let $injector = widgetContext.$scope.$injector;
let dialogs = $injector.get(widgetContext.servicesMap.get('dialogs'));
let customDialog = $injector.get(widgetContext.servicesMap.get('customDialog'));
let attributeService = $injector.get(widgetContext.servicesMap.get('attributeService'));

const t = widgetContext.custom.t;

openDeleteEntityDialog();

function openDeleteEntityDialog() {
  customDialog.customDialog(htmlTemplate, DeleteEntityDialogController).subscribe();
}

function DeleteEntityDialogController(instance) {
  let vm = instance;
  vm.deleteEntityFormGroup = vm.fb.group({});
  vm.holiday = [];
  let month = additionalParams.date.split('-')[0];
  let date = additionalParams.date.split('-')[1];
  vm.date = t('thingplus.time-format.md-value', { month, date });

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
    vm.deleteEntityFormGroup.markAsPristine();
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

  function loadAttribute() {
    let entityId = widgetContext.custom.ownerDatasource.entity.id;
    return widgetContext.attributeService.getEntityAttributes(entityId, 'SERVER_SCOPE', ['plannedHoliday']);
  }

  function saveAttribute() {
    let entityId = widgetContext.custom.ownerDatasource.entity.id;

    let targetIndex = vm.holiday.findIndex(item => item.date == additionalParams.date);
    if (targetIndex != -1) {
      vm.holiday.splice(targetIndex, 1);
    }

    let attributeBody = [{ key: 'plannedHoliday', value: vm.holiday }];
    return attributeService.saveEntityAttributes(entityId, 'SERVER_SCOPE', attributeBody);
  }
}
