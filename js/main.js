// Begin script when window loads
window.onload = setMap;

// Set up choropleth map
function setMap() {
    // Use Promise.all to parallelize asynchronous data loading
    var promises = [
        d3.csv("data/CountyData.csv"), // Load CSV data
        d3.json("data/tx_counties.topojson"), // Load Texas counties TopoJSON
        d3.json("data/usa_states.topojson") // Load USA states TopoJSON
    ];

    // Call `callback` once data is loaded
    Promise.all(promises)
        .then(callback)
        .catch(function (error) {
            console.error("Error loading data: ", error); // Log any errors
        });
}

// Define callback function to process and visualize data
function callback(data) {
    var csvData = data[0]; // CountyData.csv
    var txTopojsonData = data[1]; // tx_counties.topojson
    var statesTopojsonData = data[2]; // usa_states.topojson

    // Set dimensions for the map
    var mapWidth = document.getElementById("map").offsetWidth,
        height = 600;

    // Create an SVG element to hold the map
    var svg = d3.select("#map")
        .append("svg")
        .attr("width", mapWidth)
        .attr("height", height);

    // Convert TopoJSON to GeoJSON
    var counties = topojson.feature(txTopojsonData, txTopojsonData.objects.tx_counties).features;
    var states = topojson.feature(statesTopojsonData, statesTopojsonData.objects.states).features;

    // Define a projection and path generator
    var projection = d3.geoAlbersUsa()
        .fitSize([mapWidth, height], topojson.feature(txTopojsonData, txTopojsonData.objects.tx_counties));

    var path = d3.geoPath().projection(projection); // Create a path generator

    // Add state boundaries to the map
    svg.selectAll(".state") // Create a path for each state
        .data(states) // Bind GeoJSON data to the SVG elements
        .enter() // Create new SVG elements
        .append("path") // Append SVG path elements
        .attr("class", "state") // Assign "state" class
        .attr("d", path) // Project data as geometry in SVG
        .style("fill", "none") // No fill color
        .style("stroke", "#000") // Black stroke color
        .style("stroke-width", 2); // Stroke width of 2

    // Extract all MedianHomePrice values for the domain
    var homePrices = csvData.map(d => +d.MedianHomePrice);

    // Define a color scale for the choropleth using Quantile
    var colorScale = d3.scaleQuantile()
        .domain(homePrices)
        .range(d3.schemeBlues[9]); // Use a blue color scheme

    // Join CSV data to GeoJSON based on county name
    counties.forEach(function (county) {
        var countyName = county.properties.COUNTY; // Get the county name
        var csvEntry = csvData.find(row => row.COUNTY === countyName); // Find the CSV entry for the county
        county.properties.MedianHomePrice = csvEntry ? +csvEntry.MedianHomePrice : 0; // Assign the MedianHomePrice to the GeoJSON properties
    });

    // Draw counties on the map
    svg.selectAll(".county")
        .data(counties)
        .enter()
        .append("path")
        .attr("class", "county")
        .attr("d", path)
        .style("fill", d => {
            if (!d.properties.MedianHomePrice || isNaN(d.properties.MedianHomePrice)) {
                return "#ccc"; // Gray for missing data
            }
            return colorScale(d.properties.MedianHomePrice);
        })
        .style("stroke", "#fff")
        .on("mouseover", function (event, d) {
            // Show tooltip with county data
            tooltip.style("display", "block")
                .html(
                    `<strong>County:</strong> ${d.properties.COUNTY || "N/A"}<br>
                    <strong>Median Home Price:</strong> ${d.properties.MedianHomePrice ? `$${d.properties.MedianHomePrice.toLocaleString()}` : "No data"}` // Format MedianHomePrice as currency or show "No data"
                )
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mousemove", function (event) { // when user hovers over a county it will show the tooltip
            // Update tooltip position
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () { // when user moves the mouse out of the county it will hide the tooltip
            // Hide tooltip
            tooltip.style("display", "none");
        });

    // Create the bar chart
    setChart(csvData, colorScale);
}
// THIS IS WHERE THE CHART IS CREATED
function setChart(csvData, colorScale) {
    var chartWidth = document.getElementById("chart").offsetWidth,
        chartHeight = 400,
        leftPadding = 40, // Increased padding for the axis
        rightPadding = 5,
        topBottomPadding = 20,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

    // Create an SVG container for the chart
    var chart = d3.select("#chart")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");

    // Create a background rectangle
    chart.append("rect")
        .attr("class", "chartBackground")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate)
        .style("fill", "#f9f9f9");

    // Create a scale to size bars proportionally to the frame
    var yScale = d3.scaleLinear()
        .range([chartInnerHeight, 0])
        .domain([0, d3.max(csvData, d => +d.MedianHomePrice)]);

    // Draw bars for each county
    chart.selectAll(".bar")
        .data(csvData) // Bind data to the SVG elements
        .enter()
        .append("rect") // Create a rectangle shape for each data value
        .attr("class", "bar")
        .attr("x", (d, i) => i * (chartInnerWidth / csvData.length * 0.9) + leftPadding) // Adjust spacing... play around with this value to get the desired look
        .attr("y", d => yScale(+d.MedianHomePrice) + topBottomPadding) // Position bars based on MedianHomePrice
        .attr("height", d => chartInnerHeight - yScale(+d.MedianHomePrice)) // Set bar height based on MedianHomePrice
        .attr("width", chartInnerWidth / csvData.length * 0.6) // Set bar width. play around with this value and above to get the desired look
        .style("fill", d => colorScale(+d.MedianHomePrice)) // Fill bars with color based on MedianHomePrice
        .on("mouseover", function (event, d) {
            // Show tooltip with bar data
            tooltip.style("display", "block")
                .html(
                    `<strong>County:</strong> ${d.COUNTY}<br>
                    <strong>Median Home Price:</strong> $${(+d.MedianHomePrice).toLocaleString()}`
                )
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mousemove", function (event) { // when user hovers over a bar it will show the tooltip
            // Update tooltip position
            tooltip.style("left", (event.pageX + 10) + "px") // Offset tooltip 10px to the right for readability
                .style("top", (event.pageY - 28) + "px"); // and also Offset tooltip 28px up for readability
        })
        .on("mouseout", function () {
            // Hide tooltip
            tooltip.style("display", "none"); // when user moves the mouse out of the bar it will hide the tooltip
        });

    // Create a vertical axis
    var yAxis = d3.axisLeft().scale(yScale);

    // Place the Y-axis
    chart.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(${leftPadding}, ${topBottomPadding})`)
        .call(yAxis);
}



// Create the tooltip variable to show the data when the user hovers over a county or a bar
var tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("padding", "10px")
    .style("background-color", "white")
    .style("border", "1px solid #ccc")
    .style("border-radius", "4px")
    .style("pointer-events", "none")
    .style("display", "none");
