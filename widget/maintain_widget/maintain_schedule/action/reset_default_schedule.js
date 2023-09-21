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
  vm.entityName = entityLabel;
  vm.deleteEntityFormGroup = vm.fb.group({});

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
    let observables = [];
    let attributeBody = [{ key: 'plannedCustom', value: {} }];

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
}
