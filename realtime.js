
// Ensure station_24_data is available
if (!window.station_24_data) {
  console.error("station_24_data not loaded!");
} else {
  // Flatten the 2D array
  const flatData = station_24_data.flat();

  // Filter for StationID = "66"
  const station66Data = flatData.filter(entry => entry.StationID === "66");

  if (station66Data.length === 0) {
    console.warn("No data found for StationID 66.");
  } else {
    // Sort by DateTime descending to get the most recent
    station66Data.sort((a, b) => new Date(b.DateTime) - new Date(a.DateTime));
    const latest = station66Data[0];

    // Parse NO2 and O3 values
    const x = parseFloat(latest.NO2);
    const y = parseFloat(latest.O3);

    if (!isNaN(x) && !isNaN(y)) {
      console.log(`自动点：站点=66, 时间=${latest.DateTime}, NO2=${x}, O3=${y}`);
      // Add to userPoints and replot
      if (typeof userPoints !== 'undefined') {
        userPoints.push({x: x, y: y});
        loadAndDrawCurves();
      } else {
        console.error("userPoints array not defined.");
      }
    } else {
      console.error("NO2 or O3 value is invalid.");
    }
  }
}
