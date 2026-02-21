(function () {
  window.ACoordState = {
    currentStructure: null,
    currentSelectedAtom: null,
    selectedAtomIds: [],
    adsorptionReferenceId: null,
    adsorptionAdsorbateIds: [],
    manualScale: 1,
    autoScaleEnabled: false,
    atomSizeScale: 1,
    viewZoom: 1,
    projectionMode: 'orthographic',
    scaleAtomsWithLattice: false,
    supercell: [1, 1, 1],
    unitCellEditing: false,
    renderAtomOffsets: {},
    shouldFitCamera: true,
    groupMoveActive: false,
    lastDragWorld: null,
    rotationAxis: 'z',
    rotationInProgress: false,
  };
})();
