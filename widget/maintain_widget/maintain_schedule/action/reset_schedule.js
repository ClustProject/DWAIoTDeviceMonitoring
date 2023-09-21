let $injector = widgetContext.$scope.$injector;
let dialogs = $injector.get(widgetContext.servicesMap.get('dialogs'));
let customDialog = $injector.get(widgetContext.servicesMap.get('customDialog'));
let attributeService = $injector.get(widgetContext.servicesMap.get('attributeService'));

const JWT_TOKEN = window.localStorage.getItem('jwt_token');
const t = widgetContext.custom.t;

openDeleteEntityDialog();

function openDeleteEntityDialog() {
  customDialog.customDialog(htmlTemplate, DeleteEntityDialogController).subscribe();
}

function DeleteEntityDialogController(instance) {
  let vm = instance;
  vm.entityName = entityName;
  vm.deleteEntityFormGroup = vm.fb.group({});
  vm.targetTs = moment(widgetContext.$scope.targetStart).date(additionalParams.index).valueOf();
  vm.plannedCustom = widgetContext.custom.futureInfo[entityId.id].plannedCustom || {};
  vm.date = moment(vm.targetTs).format('YYYY-MM-DD');

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
    vm.deleteEntityFormGroup.markAsPristine();
    saveAttribute().subscribe(() => {
      widgetContext.updateAliases();
      vm.dialogRef.close(null);
    });
  };

  function saveAttribute() {
    delete vm.plannedCustom[vm.targetTs];
    let attributeBody = [{ key: 'plannedCustom', value: vm.plannedCustom }];

    return attributeService.saveEntityAttributes(entityId, 'SERVER_SCOPE', attributeBody);
  }
}
