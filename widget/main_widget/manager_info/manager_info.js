self.onInit = function () {
  self.ctx.custom = {};
  defineVariables();
  setTitle();
  self.onResize();
};

self.onResize = function () {
  self.ctx.custom.resizeThrottle();
};

self.onDataUpdated = function () {
  let { custom } = self.ctx;
  custom.mainData = preprocessData();
  self.ctx.detectChanges();
};

self.typeParameters = function () {
  return {
    maxDatasources: -1,
    maxDataKeys: -1,
    dataKeysOptional: true,
  };
};

// Define Variables
function defineVariables() {
  let { custom, $scope, $container } = self.ctx;

  // Define Tags
  custom.$widget = $('#widget', $container);
  custom.$widgetHeader = $('.widget-header', $container);
  custom.$widgetTitle = $('.widget-title', $container);
  custom.$widgetContent = $('.widget-content', $container);

  // Define Normal Variables
  custom.resizeThrottle = _.throttle(resize, 200, { trailing: true });
  custom.ownerDatasource = self.ctx.defaultSubscription.configuredDatasources[0];
  custom.userDatasource = self.ctx.defaultSubscription.configuredDatasources[2];
  custom.isSample = custom.ownerDatasource.type == 'function';
  custom.userDatasources = self.ctx.datasources.filter(x => x.entityAliasId == custom.userDatasource.entityAliasId);
  custom.t = t;
}

// Create Widget Title
function setTitle() {
  let { custom } = self.ctx;
  custom.$widgetTitle.html(self.ctx.widget.config.title);
  custom.$widgetTitle.css(self.ctx.widget.config.titleStyle);
}

function resize() {
  let { custom } = self.ctx;
  // 위젯 전체 크기 조절
  let originWidth = self.ctx.settings.widget.originWidth;
  if (self.ctx.isMobile) {
    originWidth = 960;
  }
  let widgetFontSize = _.round((self.ctx.width / originWidth) * 10, 2);
  if (widgetFontSize < 6.25) {
    widgetFontSize = 6.25;
  }
  custom.$widget.css('font-size', `${widgetFontSize}px`);

  // Header Height를 제외한 영역을 Main의 Height로 설정
  let headerHeight = custom.$widgetHeader.outerHeight(true);
  custom.$widgetContent.css('height', `calc(100% - ${headerHeight}px)`);
}

function preprocessData() {
  let { custom, $scope } = self.ctx;
  $scope.infoList = [];
  for (let i in self.ctx.data) {
    let target = self.ctx.data[i];
    if (!_.isNil(target.data[0])) {
      let label = target.dataKey.label;
      let data = target.data[0][1];
      let icon = target.dataKey.settings.icon;
      // Apply cell content function
      if (target.dataKey.settings.useCellContentFunction) {
        try {
          let contentFunction = new Function('value', 'ctx', target.dataKey.settings.cellContentFunction);
          data = contentFunction(data, self.ctx);
        } catch (err) {
          console.error(err);
        }
      }
      if (custom.userDatasources.length > 0) {
        if (target.datasource.entityAliasId == custom.userDatasource.entityAliasId) {
          $scope.infoList.push({
            icon: icon,
            label: t(label),
            value: data,
          });
        }
      } else {
        $scope.infoList.push({
          icon: icon,
          label: t(label),
          value: data,
        });
      }
    }
  }
  return {};
}

function t(key, data) {
  let defaultKey = key;
  if (typeof key === 'string') {
    let keyArr = key.split('.');
    defaultKey = keyArr[keyArr.length - 1];
  }
  let result = self.ctx.translate.instant(key, data);
  if (result == key) {
    return defaultKey;
  }
  return result;
}
