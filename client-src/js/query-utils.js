/* jshint esversion: 6 */
/* global getConfig, bootbox, tinycolor */
(function(){
  'use strict';
  
  class QueryUtils {
    
    static getColor(colorX, colorY, x, y, maxX, maxY, alpha, baseColor) {
      const cX = colorX || 'RED';
      const cY = colorY || 'BLUE';
      const bColor = baseColor || 100;
      const xColor = Math.floor(QueryUtils.convertToRange(x, 0, maxX, 0, 255));
      const yColor = Math.floor(QueryUtils.convertToRange(y, 0, maxY, 0, 255));
      const r = cX === 'RED' ? xColor : cY === 'RED' ? yColor : bColor;
      const g = cX === 'GREEN' ? xColor : cY === 'GREEN' ? yColor : bColor;
      const b = cX === 'BLUE' ? xColor : cY === 'BLUE' ? yColor : bColor;
      
      return tinycolor({
        r: r,
        g: g,
        b: b,
        a: alpha || 1
      }).toRgbString();
    }
    
    static convertToRange(value, fromLow, fromHigh, toLow, toHigh) {
      const fromLength = fromHigh - fromLow;
      const toRange = toHigh - toLow;
      const newValue = toRange / (fromLength / value);
      
      if (newValue < toLow) {
        return toLow;
      } else if (newValue > toHigh) {
        return toHigh;
      }
      
      return newValue;
    }
    
  }
  
  window.QueryUtils = QueryUtils;
  
})();
