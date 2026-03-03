/**
 * Display Configuration Handler
 * Manages display configurations and communication with backend
 */
(function() {
  'use strict';
  
  window.ACoordConfigHandler = {
    // Request available configurations from backend
    requestConfigList: function() {
      this.postMessage({ command: 'getDisplayConfigs' });
    },
    
    // Load a specific configuration
    loadConfig: function(configId) {
      window.ACoordState.isLoadingConfig = true;
      this.postMessage({ 
        command: 'loadDisplayConfig', 
        configId: configId 
      });
    },
    
    // Save current settings as a new user configuration
    saveAsUserConfig: function(name, description) {
      const settings = window.ACoordState.extractDisplaySettings();
      this.postMessage({
        command: 'saveDisplayConfig',
        name: name,
        description: description,
        settings: settings
      });
    },
    
    // Get current display settings from backend
    getCurrentSettings: function() {
      this.postMessage({ command: 'getCurrentDisplaySettings' });
    },
    
    // Update display settings (called when UI changes)
    updateSettings: function() {
      const handler = this;
      if (handler._settingsTimer) {
        clearTimeout(handler._settingsTimer);
      }
      handler._settingsTimer = setTimeout(function() {
        handler._settingsTimer = null;
        const settings = window.ACoordState.extractDisplaySettings();
        handler.postMessage({
          command: 'updateDisplaySettings',
          settings: settings
        });
      }, 80);
    },
    
    // Helper to normalize light config format (flat -> nested)
    normalizeLightConfig: function(light) {
      if (!light) return null;
      
      // If already has position object, use it
      if (light.position && typeof light.position.x === 'number') {
        return {
          intensity: light.intensity,
          color: light.color,
          position: {
            x: light.position.x,
            y: light.position.y,
            z: light.position.z
          }
        };
      }
      
      // Otherwise convert from flat format
      return {
        intensity: light.intensity,
        color: light.color,
        position: {
          x: light.x,
          y: light.y,
          z: light.z
        }
      };
    },
    
    // Handle messages from backend
    handleMessage: function(message) {
      switch (message.command) {
        case 'displayConfigsLoaded':
          this.handleConfigsLoaded(message.presets, message.user);
          break;
          
        case 'displayConfigLoaded':
          this.handleConfigLoaded(message.config);
          break;
          
        case 'displayConfigSaved':
          this.handleConfigSaved(message.config);
          break;
          
        case 'displayConfigChanged':
          // Config changed from another source (e.g., command palette)
          if (message.config) {
            this.handleConfigLoaded(message.config);
          }
          break;
          
        case 'currentDisplaySettings':
          if (message.settings) {
            window.ACoordState.applyDisplaySettings(message.settings);
            this.updateUI();
          }
          break;
          
        case 'displayConfigError':
          console.error('Display config error:', message.error);
          window.ACoordState.isLoadingConfig = false;
          break;
          
        case 'render':
          // Handle render message with display settings
          if (message.displaySettings) {
            window.ACoordState.applyDisplaySettings(message.displaySettings);
            this.updateUI();
          }
          break;
      }
    },
    
    // Handle loaded config list
    handleConfigsLoaded: function(presets, user) {
      window.ACoordState.availableConfigs = {
        presets: presets || [],
        user: user || []
      };
      this.updateConfigUI();
    },
    
    // Handle loaded configuration
    handleConfigLoaded: function(config) {
      if (!config || !config.settings) {
        console.error('Invalid config loaded');
        window.ACoordState.isLoadingConfig = false;
        return;
      }
      
      // Apply settings to state
      window.ACoordState.applyDisplaySettings(config.settings);
      window.ACoordState.currentConfigId = config.id;
      window.ACoordState.currentConfigName = config.name;
      window.ACoordState.isLoadingConfig = false;
      
      // Update UI controls
      this.updateUI();
      
      // Trigger renderer update if available
      if (window.ACoordRenderer && window.ACoordRenderer.updateDisplaySettings) {
        window.ACoordRenderer.updateDisplaySettings();
      }
      
      // Update config UI
      this.updateConfigUI();
      
      // Show notification
      if (window.showStatus) {
        window.showStatus(`Loaded configuration: ${config.name}`);
      }
    },
    
    // Handle saved configuration
    handleConfigSaved: function(config) {
      if (config) {
        // Refresh config list
        this.requestConfigList();
        
        if (window.showStatus) {
          window.showStatus(`Saved configuration: ${config.name}`);
        }
      }
    },
    
    // Update UI controls to match current state
    updateUI: function() {
      const state = window.ACoordState;
      
      // Helper to get light values (support both formats)
      const getLightValue = function(light, prop) {
        if (!light) return 0;
        if (prop === 'intensity' || prop === 'color') {
          return light[prop];
        }
        // For x, y, z - check both formats
        if (light.position && typeof light.position[prop] === 'number') {
          return light.position[prop];
        }
        return light[prop] || 0;
      };
      
      // Update Display Options
      const showAxes = document.getElementById('show-axes');
      if (showAxes) showAxes.checked = state.showAxes;
      
      // Update Display Settings
      const bgColorPicker = document.getElementById('bg-color-picker');
      const bgColorText = document.getElementById('bg-color-text');
      if (bgColorPicker) bgColorPicker.value = state.backgroundColor;
      if (bgColorText) bgColorText.value = state.backgroundColor;
      
      const latticeColorPicker = document.getElementById('lattice-color-picker');
      const latticeColorText = document.getElementById('lattice-color-text');
      if (latticeColorPicker) latticeColorPicker.value = state.unitCellColor;
      if (latticeColorText) latticeColorText.value = state.unitCellColor;
      
      const latticeThicknessSlider = document.getElementById('lattice-thickness-slider');
      const latticeThicknessValue = document.getElementById('lattice-thickness-value');
      if (latticeThicknessSlider) latticeThicknessSlider.value = state.unitCellThickness;
      if (latticeThicknessValue) latticeThicknessValue.textContent = state.unitCellThickness.toFixed(1);
      
      const latticeLineStyle = document.getElementById('lattice-line-style');
      if (latticeLineStyle) latticeLineStyle.value = state.unitCellLineStyle;
      
      // Update Atom & Bond Size
      const atomSizeGlobalSlider = document.getElementById('atom-size-global-slider');
      const atomSizeGlobalValue = document.getElementById('atom-size-global-value');
      if (atomSizeGlobalSlider) atomSizeGlobalSlider.value = state.atomSizeGlobal;
      if (atomSizeGlobalValue) atomSizeGlobalValue.textContent = state.atomSizeGlobal.toFixed(2) + ' Å';
      
      const atomSizeUseDefault = document.getElementById('atom-size-use-default');
      if (atomSizeUseDefault) atomSizeUseDefault.checked = state.atomSizeUseDefaultSettings;
      
      const bondSizeSlider = document.getElementById('bond-size-slider');
      const bondSizeValue = document.getElementById('bond-size-value');
      if (bondSizeSlider) bondSizeSlider.value = state.bondThicknessScale;
      if (bondSizeValue) bondSizeValue.textContent = state.bondThicknessScale.toFixed(1) + 'x';
      
      // Update Display Scale
      const scaleSlider = document.getElementById('scale-slider');
      const scaleValue = document.getElementById('scale-value');
      if (scaleSlider) scaleSlider.value = state.manualScale;
      if (scaleValue) scaleValue.textContent = state.manualScale.toFixed(1) + 'x';

      const scaleAutoToggle = document.getElementById('scale-auto');
      if (scaleAutoToggle) scaleAutoToggle.checked = !!state.autoScaleEnabled;
      
      const sizeSlider = document.getElementById('size-slider');
      const sizeValue = document.getElementById('size-value');
      if (sizeSlider) sizeSlider.value = state.atomSizeScale;
      if (sizeValue) sizeValue.textContent = state.atomSizeScale.toFixed(2) + 'x';
      
      // Update Lighting
      const lightingEnabled = document.getElementById('lighting-enabled');
      if (lightingEnabled) lightingEnabled.checked = state.lightingEnabled;
      
      const ambientSlider = document.getElementById('ambient-slider');
      const ambientValue = document.getElementById('ambient-value');
      if (ambientSlider) ambientSlider.value = state.ambientIntensity;
      if (ambientValue) ambientValue.textContent = state.ambientIntensity.toFixed(1);
      
      const ambientColorPicker = document.getElementById('ambient-color-picker');
      if (ambientColorPicker) ambientColorPicker.value = state.ambientColor;
      
      const shininessSlider = document.getElementById('shininess-slider');
      const shininessValue = document.getElementById('shininess-value');
      if (shininessSlider) shininessSlider.value = state.shininess;
      if (shininessValue) shininessValue.textContent = state.shininess.toString();
      
      // Update Key Light
      const keyIntensitySlider = document.getElementById('key-intensity-slider');
      const keyIntensityValue = document.getElementById('key-intensity-value');
      if (keyIntensitySlider) keyIntensitySlider.value = getLightValue(state.keyLight, 'intensity');
      if (keyIntensityValue) keyIntensityValue.textContent = getLightValue(state.keyLight, 'intensity').toFixed(1);
      
      const keyColorPicker = document.getElementById('key-color-picker');
      if (keyColorPicker) keyColorPicker.value = getLightValue(state.keyLight, 'color');
      
      const keyXSlider = document.getElementById('key-x-slider');
      const keyXValue = document.getElementById('key-x-value');
      if (keyXSlider) keyXSlider.value = getLightValue(state.keyLight, 'x');
      if (keyXValue) keyXValue.textContent = getLightValue(state.keyLight, 'x').toString();
      
      const keyYSlider = document.getElementById('key-y-slider');
      const keyYValue = document.getElementById('key-y-value');
      if (keyYSlider) keyYSlider.value = getLightValue(state.keyLight, 'y');
      if (keyYValue) keyYValue.textContent = getLightValue(state.keyLight, 'y').toString();
      
      const keyZSlider = document.getElementById('key-z-slider');
      const keyZValue = document.getElementById('key-z-value');
      if (keyZSlider) keyZSlider.value = getLightValue(state.keyLight, 'z');
      if (keyZValue) keyZValue.textContent = getLightValue(state.keyLight, 'z').toString();
      
      // Update Fill Light
      const fillIntensitySlider = document.getElementById('fill-intensity-slider');
      const fillIntensityValue = document.getElementById('fill-intensity-value');
      if (fillIntensitySlider) fillIntensitySlider.value = getLightValue(state.fillLight, 'intensity');
      if (fillIntensityValue) fillIntensityValue.textContent = getLightValue(state.fillLight, 'intensity').toFixed(1);
      
      const fillColorPicker = document.getElementById('fill-color-picker');
      if (fillColorPicker) fillColorPicker.value = getLightValue(state.fillLight, 'color');
      
      const fillXSlider = document.getElementById('fill-x-slider');
      const fillXValue = document.getElementById('fill-x-value');
      if (fillXSlider) fillXSlider.value = getLightValue(state.fillLight, 'x');
      if (fillXValue) fillXValue.textContent = getLightValue(state.fillLight, 'x').toString();
      
      const fillYSlider = document.getElementById('fill-y-slider');
      const fillYValue = document.getElementById('fill-y-value');
      if (fillYSlider) fillYSlider.value = getLightValue(state.fillLight, 'y');
      if (fillYValue) fillYValue.textContent = getLightValue(state.fillLight, 'y').toString();
      
      const fillZSlider = document.getElementById('fill-z-slider');
      const fillZValue = document.getElementById('fill-z-value');
      if (fillZSlider) fillZSlider.value = getLightValue(state.fillLight, 'z');
      if (fillZValue) fillZValue.textContent = getLightValue(state.fillLight, 'z').toString();
      
      // Update Rim Light
      const rimIntensitySlider = document.getElementById('rim-intensity-slider');
      const rimIntensityValue = document.getElementById('rim-intensity-value');
      if (rimIntensitySlider) rimIntensitySlider.value = getLightValue(state.rimLight, 'intensity');
      if (rimIntensityValue) rimIntensityValue.textContent = getLightValue(state.rimLight, 'intensity').toFixed(1);
      
      const rimColorPicker = document.getElementById('rim-color-picker');
      if (rimColorPicker) rimColorPicker.value = getLightValue(state.rimLight, 'color');
      
      const rimXSlider = document.getElementById('rim-x-slider');
      const rimXValue = document.getElementById('rim-x-value');
      if (rimXSlider) rimXSlider.value = getLightValue(state.rimLight, 'x');
      if (rimXValue) rimXValue.textContent = getLightValue(state.rimLight, 'x').toString();
      
      const rimYSlider = document.getElementById('rim-y-slider');
      const rimYValue = document.getElementById('rim-y-value');
      if (rimYSlider) rimYSlider.value = getLightValue(state.rimLight, 'y');
      if (rimYValue) rimYValue.textContent = getLightValue(state.rimLight, 'y').toString();
      
      const rimZSlider = document.getElementById('rim-z-slider');
      const rimZValue = document.getElementById('rim-z-value');
      if (rimZSlider) rimZSlider.value = getLightValue(state.rimLight, 'z');
      if (rimZValue) rimZValue.textContent = getLightValue(state.rimLight, 'z').toString();
      
      // Update Projection Mode
      const projSelect = document.getElementById('proj-select');
      if (projSelect) projSelect.value = state.projectionMode;

      const latticeScaleToggle = document.getElementById('lattice-scale');
      if (latticeScaleToggle) latticeScaleToggle.checked = !!state.scaleAtomsWithLattice;
    },
    
    // Update configuration UI (config selector)
    updateConfigUI: function() {
      // This will be called when config list is loaded
      // The actual UI update will be handled by the config UI component
      if (window.updateConfigSelector) {
        window.updateConfigSelector();
      }
    },
    
    // Helper to post message to VS Code
    postMessage: function(message) {
      if (window.vscode) {
        window.vscode.postMessage(message);
      }
    }
  };
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      window.ACoordConfigHandler.requestConfigList();
      window.ACoordConfigHandler.getCurrentSettings();
    });
  } else {
    window.ACoordConfigHandler.requestConfigList();
    window.ACoordConfigHandler.getCurrentSettings();
  }
})();
