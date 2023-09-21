let $injector = widgetContext.$scope.$injector;
let attributeService = $injector.get(widgetContext.servicesMap.get('attributeService'));
let attributeBody = [{ key: 'isEnable', value: additionalParams.isEnable == 'true' ? false : true }];
attributeService.saveEntityAttributes(entityId, 'SERVER_SCOPE', attributeBody).subscribe(() => {});
