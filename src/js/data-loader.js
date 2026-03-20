/**
 * @file data-loader.js
 * @description Central data loader for NEC tables and constants
 * 
 * This module loads all NEC data from JSON files and provides it to calculators.
 * Data is cached after first load for performance.
 */

const NECDataLoader = (() => {
  let cache = {};
  
  /**
   * Loads NEC data for a specific version
   * @param {string} version - NEC version (e.g., "2023")
   * @returns {Promise<Object>} Object containing all NEC data
   */
  async function loadNECData(version = "2023") {
    if (cache[version]) {
      return cache[version];
    }

    // NEC 2023 data inlined — no fetch() required, works on all hosts
    if (version === '2023') {
      cache[version] = {"conduit":{"EMT":{"1/2":0.304,"3/4":0.533,"1":0.864,"1-1/4":1.496,"1-1/2":2.036,"2":3.356,"2-1/2":5.858,"3":8.846,"4":15.432},"PVC-40":{"1/2":0.269,"3/4":0.475,"1":0.785,"1-1/4":1.363,"1-1/2":1.863,"2":3.068,"2-1/2":4.407,"3":6.835,"4":11.858},"PVC-80":{"1/2":0.198,"3/4":0.37,"1":0.632,"1-1/4":1.127,"1-1/2":1.567,"2":2.635,"2-1/2":3.84,"3":6.008,"4":10.511},"RMC (Rigid)":{"1/2":0.314,"3/4":0.549,"1":0.887,"1-1/4":1.526,"1-1/2":2.071,"2":3.408,"2-1/2":4.881,"3":7.513,"4":12.882},"FMC (Flex)":{"1/2":0.317,"3/4":0.531,"1":0.845,"1-1/4":1.333,"1-1/2":1.89,"2":3.356},"LFMC (Liquidtight)":{"1/2":0.317,"3/4":0.531,"1":0.845,"1-1/4":1.333,"1-1/2":1.89,"2":3.356},"LFNC-B":{"1/2":0.307,"3/4":0.535,"1":0.854,"1-1/4":1.413,"1-1/2":1.936,"2":3.36},"sizes":["1/2","3/4","1","1-1/4","1-1/2","2","2-1/2","3","3-1/2","4"],"fillLimits":{"1":53,"2":31,"3+":40}},"conductors":{"wireData":{"CU THHN/THWN":{"stranded":{"14":0.0097,"12":0.0133,"10":0.0211,"8":0.0366,"6":0.0507,"4":0.0824,"3":0.0973,"2":0.1158,"1":0.1562,"1/0":0.1855,"2/0":0.2223,"3/0":0.2679,"4/0":0.3237,"250":0.397,"500":0.7073,"750":1.0182},"solid":{"14":0.0087,"12":0.0117,"10":0.0172,"8":0.0299}},"CU XHHW":{"stranded":{"14":0.0139,"12":0.0181,"10":0.0243,"8":0.0437,"6":0.059,"4":0.0814,"3":0.0962,"2":0.1146,"1":0.1503,"1/0":0.1825,"2/0":0.219,"3/0":0.2642,"4/0":0.3197,"250":0.3904,"500":0.6985,"750":1.0066},"solid":{"14":0.0127,"12":0.0163,"10":0.0219,"8":0.0363}},"AL THHN/THWN":{"stranded":{"12":0.0133,"10":0.0211,"8":0.0366,"6":0.0507,"4":0.0824,"2":0.1158,"1":0.1562,"1/0":0.1855,"2/0":0.2223,"3/0":0.2679,"4/0":0.3237,"250":0.397,"500":0.7073,"750":1.0182},"solid":{"12":0.0117,"10":0.0172,"8":0.0299}},"AL XHHW":{"stranded":{"12":0.0181,"10":0.0243,"8":0.0437,"6":0.059,"4":0.0814,"2":0.1146,"1":0.1503,"1/0":0.1825,"2/0":0.219,"3/0":0.2642,"4/0":0.3197,"250":0.3904,"500":0.6985,"750":1.0066},"solid":{"12":0.0163,"10":0.0219,"8":0.0363}}},"circularMils":{"14":4110,"12":6530,"10":10380,"8":16510,"6":26240,"4":41740,"3":52620,"2":66360,"1":83690,"1/0":105600,"2/0":133100,"3/0":167800,"4/0":211600,"250":250000,"350":350000,"500":500000,"750":750000},"kFactors":{"CU":12.9,"AL":21.2},"phaseMultiplier":{"1":2,"3":1.732},"wireSizeOrder":["14","12","10","8","6","4","3","2","1","1/0","2/0","3/0","4/0","250","350","500","750"]},"boxfill":{"volumePerWire":{"18":1.5,"16":1.75,"14":2.0,"12":2.25,"10":2.5,"8":3.0,"6":5.0}},"pullbox":{"sizes":{"1/2":0.5,"3/4":0.75,"1":1.0,"1-1/4":1.25,"1-1/2":1.5,"2":2.0,"2-1/2":2.5,"3":3.0,"3-1/2":3.5,"4":4.0,"5":5.0,"6":6.0},"sizeOrder":["1/2","3/4","1","1-1/4","1-1/2","2","2-1/2","3","3-1/2","4","5","6"],"pullTypeLabels":{"straight":"Straight","angle":"Angle","u":"U-Pull"},"sideLabels":{"left":"Left","right":"Right","top":"Top","bottom":"Bottom"},"oppositeWall":{"left":"right","right":"left","top":"bottom","bottom":"top"}},"serviceLoad":{"systemVoltage":240,"standardSizes":[100,125,150,200,225,320,400,600],"lightingVAPerSqFt":3,"smallApplianceCircuits":2,"smallApplianceVAPerCircuit":1500,"laundryCircuits":1,"laundryVAPerCircuit":1500,"lightingDemandTable":[{"upTo":3000,"factor":1.0,"label":"First 3,000 VA \u00d7 100%"},{"upTo":120000,"factor":0.35,"label":"Next 117,000 VA (3,001\u2013120,000 VA) \u00d7 35%"},{"factor":0.25,"label":"Remainder over 120,000 VA \u00d7 25%"}],"fixedApplianceDemandFactor":0.75,"fixedApplianceThreshold":4,"dryerMinVA":5000,"electricHeatFactor":1.0,"optionalFirstVA":10000,"optional220_83FirstVA":8000,"optionalFirstFactor":1.0,"optionalRemainderFactor":0.4,"rangeBreakpoints":{"colBMax":8.75,"colCMaxKW":12.0,"colABFactor":0.8,"colCBaseKW":8.0,"overCIncrementPerKW":0.05},"conductorSizes":[{"awg":"4 AWG CU / 2 AWG AL","amps":100},{"awg":"2 AWG CU / 1/0 AL","amps":125},{"awg":"1 AWG CU / 2/0 AL","amps":150},{"awg":"3/0 CU / 4/0 AL","amps":200},{"awg":"4/0 CU / 250 kcmil AL","amps":225},{"awg":"350 kcmil CU / 500 kcmil AL","amps":320},{"awg":"500 kcmil CU / 750 kcmil AL","amps":400},{"awg":"Multiple paralleled sets","amps":600}],"gecSizes":[{"amps":100,"awg":"#8 AWG Cu / #6 AWG Al"},{"amps":125,"awg":"#8 AWG Cu / #6 AWG Al"},{"amps":150,"awg":"#6 AWG Cu / #4 AWG Al"},{"amps":200,"awg":"#4 AWG Cu / #2 AWG Al"},{"amps":225,"awg":"#2 AWG Cu / #1/0 AWG Al"},{"amps":320,"awg":"#2 AWG Cu / #1/0 AWG Al"},{"amps":400,"awg":"#1/0 AWG Cu / #3/0 AWG Al"},{"amps":600,"awg":"Per 250.66(A) Note (paralleled sets)"}]}};
      return cache[version];
    }

    throw new Error(`No data available for NEC version: ${version}`);
  }

  /**
   * Gets cached data without reloading
   * @param {string} version - NEC version
   * @returns {Object|null} Cached data or null if not loaded
   */
  function getCachedData(version = "2023") {
    return cache[version] || null;
  }

  /**
   * Clears the data cache (useful for testing or version switching)
   */
  function clearCache() {
    cache = {};
  }

  return {
    loadNECData,
    getCachedData,
    clearCache
  };
})();

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NECDataLoader;
}

// Make available globally for browser use
if (typeof window !== 'undefined') {
  window.NECDataLoader = NECDataLoader;
}