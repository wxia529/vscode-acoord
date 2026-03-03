(function () {
  window.ACoordState = {
    currentStructure: null,
    currentSelectedAtom: null,
    currentSelectedBondKey: null,
    selectedBondKeys: [],
    selectedAtomIds: [],
    isDragging: false,
    dragAtomId: null,
    adsorptionReferenceId: null,
    adsorptionAdsorbateIds: [],
    manualScale: 1,
    autoScaleEnabled: false,
    atomSizeScale: 1,
    bondThicknessScale: 1,
    viewZoom: 1,
    projectionMode: 'orthographic',
    scaleAtomsWithLattice: false,
    supercell: [1, 1, 1],
    unitCellEditing: false,
    renderAtomOffsets: {},
    shouldFitCamera: true,
    groupMoveActive: false,
    trajectoryFrameIndex: 0,
    trajectoryFrameCount: 1,
    trajectoryPlaying: false,
    trajectoryPlaybackFps: 8,
    lastDragWorld: null,
    dragPlaneNormal: null,
    rotationAxis: 'z',
    rotationInProgress: false,
    
    // Display settings
    showAxes: true,
    backgroundColor: '#0d1015',
    unitCellColor: '#FF6600',
    unitCellThickness: 1,
    unitCellLineStyle: 'solid',
    atomSizeUseDefaultSettings: true,
    atomSizeGlobal: 0.3,
    atomSizeByElement: {},
    atomSizeByAtom: {},
    atomSizeElementExpanded: false,
    shininess: 50,
    
    // Lighting settings
    lightingEnabled: true,
    ambientIntensity: 0.5,
    ambientColor: '#ffffff',
    keyLight: { intensity: 0.7, x: 0, y: 0, z: 10, color: '#CCCCCC' },
    fillLight: { intensity: 0, x: -10, y: -5, z: 5, color: '#ffffff' },
    rimLight: { intensity: 0, x: 0, y: 5, z: -10, color: '#ffffff' },
    
    // Configuration management
    currentConfigId: 'preset-default',
    currentConfigName: 'Default',
    availableConfigs: { presets: [], user: [] },
    isLoadingConfig: false
  };
  
  // Helper to extract display settings from state
  window.ACoordState.extractDisplaySettings = function() {
    // Helper to normalize light config to nested format
    const normalizeLight = function(light) {
      if (!light) return { intensity: 0, color: '#ffffff', position: { x: 0, y: 0, z: 0 } };
      
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
    };
    
    return {
      showAxes: this.showAxes,
      backgroundColor: this.backgroundColor,
      unitCellColor: this.unitCellColor,
      unitCellThickness: this.unitCellThickness,
      unitCellLineStyle: this.unitCellLineStyle,
      atomSizeUseDefaultSettings: this.atomSizeUseDefaultSettings,
      atomSizeGlobal: this.atomSizeGlobal,
      atomSizeByElement: this.atomSizeByElement,
      atomSizeByAtom: this.atomSizeByAtom,
      manualScale: this.manualScale,
      autoScaleEnabled: this.autoScaleEnabled,
      atomSizeScale: this.atomSizeScale,
      bondThicknessScale: this.bondThicknessScale,
      viewZoom: this.viewZoom,
      scaleAtomsWithLattice: this.scaleAtomsWithLattice,
      projectionMode: this.projectionMode,
      lightingEnabled: this.lightingEnabled,
      ambientIntensity: this.ambientIntensity,
      ambientColor: this.ambientColor,
      shininess: this.shininess,
      keyLight: normalizeLight(this.keyLight),
      fillLight: normalizeLight(this.fillLight),
      rimLight: normalizeLight(this.rimLight)
    };
  };
  
  // Helper to apply display settings to state
  window.ACoordState.applyDisplaySettings = function(settings) {
    if (!settings) return;
    
    this.showAxes = settings.showAxes ?? this.showAxes;
    this.backgroundColor = settings.backgroundColor ?? this.backgroundColor;
    this.unitCellColor = settings.unitCellColor ?? this.unitCellColor;
    this.unitCellThickness = settings.unitCellThickness ?? this.unitCellThickness;
    this.unitCellLineStyle = settings.unitCellLineStyle ?? this.unitCellLineStyle;
    this.atomSizeUseDefaultSettings = settings.atomSizeUseDefaultSettings ?? this.atomSizeUseDefaultSettings;
    this.atomSizeGlobal = settings.atomSizeGlobal ?? this.atomSizeGlobal;
    this.atomSizeByElement = settings.atomSizeByElement ?? this.atomSizeByElement;
    this.atomSizeByAtom = settings.atomSizeByAtom ?? this.atomSizeByAtom;
    this.manualScale = settings.manualScale ?? this.manualScale;
    this.autoScaleEnabled = settings.autoScaleEnabled ?? this.autoScaleEnabled;
    this.atomSizeScale = settings.atomSizeScale ?? this.atomSizeScale;
    this.bondThicknessScale = settings.bondThicknessScale ?? this.bondThicknessScale;
    this.viewZoom = settings.viewZoom ?? this.viewZoom;
    this.scaleAtomsWithLattice = settings.scaleAtomsWithLattice ?? this.scaleAtomsWithLattice;
    this.projectionMode = settings.projectionMode ?? this.projectionMode;
    this.lightingEnabled = settings.lightingEnabled ?? this.lightingEnabled;
    this.ambientIntensity = settings.ambientIntensity ?? this.ambientIntensity;
    this.ambientColor = settings.ambientColor ?? this.ambientColor;
    this.shininess = settings.shininess ?? this.shininess;
    this.keyLight = settings.keyLight ?? this.keyLight;
    this.fillLight = settings.fillLight ?? this.fillLight;
    this.rimLight = settings.rimLight ?? this.rimLight;
  };
})();
