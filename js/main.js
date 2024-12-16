// Global variables for dynamic attributes
let selectedAttribute = "MedianHomePrice";

// Mapping for display names
const attributeDisplayNames = {
    "MedianHomePrice": "Median Home Price",
    "Pop 2023": "Population (2023)",
    "Poverty": "Poverty Rate",
    "Median Household Income (2021)": "Median Household Income (2021)",
    "% of State Median HH Income": "% of State Median HH Income"
};

window.onload = setMap;

function setMap() {
    var promises = [
        d3.csv("data/CountyData.csv"), // CSV data
        d3.json("data/tx_counties.topojson"), // Texas counties TopoJSON
        d3.json("data/usa_states.topojson") // USA states TopoJSON
    ];

    Promise.all(promises)
        .then(callback)
        .catch(function (error) {
            console.error("Error loading data: ", error);
        });
}

function callback(data) {
    var csvData = data[0];
    var txTopojsonData = data[1];
    var statesTopojsonData = data[2];

    // Set map dimensions
    var mapWidth = document.getElementById("map").offsetWidth,
        height = 600;

    var svg = d3.select("#map")
        .append("svg")
        .attr("width", mapWidth)
        .attr("height", height);

    // Convert TopoJSON to GeoJSON
    var counties = topojson.feature(txTopojsonData, txTopojsonData.objects.tx_counties).features;
    var states = topojson.feature(statesTopojsonData, statesTopojsonData.objects.states).features;

    // Set projection and path generator
    var projection = d3.geoAlbersUsa()
        .fitSize([mapWidth, height], topojson.feature(txTopojsonData, txTopojsonData.objects.tx_counties));
    var path = d3.geoPath().projection(projection);

    // Draw state boundaries
    svg.selectAll(".state")
        .data(states)
        .enter()
        .append("path")
        .attr("class", "state")
        .attr("d", path)
        .style("fill", "none")
        .style("stroke", "#000")
        .style("stroke-width", 2);

    // Process CSV data and join with GeoJSON
    processCSVData(csvData, counties);

    // Draw the initial map and chart
    drawMap(svg, counties, path);
    setChart(counties, getColorScale(counties));

    // Create dropdown for attributes
    createDropdown(csvData, counties, svg, path);
}

function processCSVData(csvData, counties) {
    // Clean and join CSV data with GeoJSON
    csvData.forEach(d => {
        d.MedianHomePrice = +d.MedianHomePrice;
        d["Pop 2023"] = +d["Pop 2023"].replace(/,/g, "");
        d.Poverty = +d.Poverty;
        d["Median Household Income (2021)"] = +d["Median Household Income (2021)"].replace(/[\$,]/g, "");
        d["% of State Median HH Income"] = +d["% of State Median HH Income"].replace("%", "");

        var countyMatch = counties.find(c => c.properties.COUNTY === d.COUNTY);
        if (countyMatch) {
            Object.assign(countyMatch.properties, d);
        }
    });
}

function createDropdown(csvData, counties, svg, path) {
    var attributes = Object.keys(csvData[0]).filter(attr => attr !== "COUNTY");

    // Add dropdown
    var dropdown = d3.select("body")
        .append("select")
        .attr("class", "attribute-dropdown")
        .on("change", function () {
            selectedAttribute = this.value;
            updateVisualization(svg, counties, path);
        });

    dropdown.selectAll("option")
        .data(attributes)
        .enter()
        .append("option")
        .attr("value", d => d)
        .text(d => attributeDisplayNames[d] || d); // Use display name if available
}

function drawMap(svg, counties, path) {
    var colorScale = getColorScale(counties);

    // Clear previous map paths
    svg.selectAll(".county").remove();

    svg.selectAll(".county")
        .data(counties)
        .enter()
        .append("path")
        .attr("class", "county")
        .attr("d", path)
        .style("fill", d => {
            var value = d.properties[selectedAttribute];
            return value ? colorScale(value) : "#ccc";
        })
        .style("stroke", "#fff")
        .on("mouseover", function (event, d) {
            tooltip.style("display", "block")
                .html(`<strong>County:</strong> ${d.properties.COUNTY || "N/A"}<br>
                       <strong>${attributeDisplayNames[selectedAttribute] || selectedAttribute}:</strong> ${formatValue(d.properties[selectedAttribute], selectedAttribute)}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mousemove", function (event) {
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
            tooltip.style("display", "none");
        });
}

function updateVisualization(svg, counties, path) {
    // Redraw map
    drawMap(svg, counties, path);

    // Redraw the chart
    setChart(counties, getColorScale(counties));
}

function setChart(counties, colorScale) {
    var csvData = counties.map(d => d.properties);

    var chartWidth = document.getElementById("chart").offsetWidth,
        chartHeight = 400,
        leftPadding = 60, // Increased padding for Y-axis
        rightPadding = 20,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - 40;

    d3.select("#chart").selectAll("*").remove(); // Clear previous chart
    var chart = d3.select("#chart")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight);

    var yScale = d3.scaleLinear()
        .range([chartInnerHeight, 0])
        .domain([0, d3.max(csvData, d => d[selectedAttribute])]);

    // Add bars
    chart.selectAll(".bar")
        .data(csvData.sort((a, b) => b[selectedAttribute] - a[selectedAttribute]))
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", (d, i) => leftPadding + i * (chartInnerWidth / csvData.length)) // Start after Y-axis
        .attr("y", d => yScale(d[selectedAttribute]))
        .attr("height", d => chartInnerHeight - yScale(d[selectedAttribute]))
        .attr("width", chartInnerWidth / csvData.length - 1)
        .style("fill", d => colorScale(d[selectedAttribute]))
        .on("mouseover", function (event, d) {
            tooltip.style("display", "block")
                .html(`<strong>County:</strong> ${d.COUNTY}<br>
                       <strong>${attributeDisplayNames[selectedAttribute] || selectedAttribute}:</strong> ${formatValue(d[selectedAttribute], selectedAttribute)}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mousemove", function (event) {
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
            tooltip.style("display", "none");
        });

    // Add Y-axis
    var yAxis = d3.axisLeft(yScale)
        .tickFormat(d => formatValue(d, selectedAttribute).replace("$", "").replace("%", ""));

    chart.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(${leftPadding}, 0)`) // Place Y-axis inside padding
        .call(yAxis);
}

function getColorScale(counties) {
    var values = counties.map(d => d.properties[selectedAttribute]).filter(v => !isNaN(v));
    return d3.scaleQuantile()
        .domain(values)
        .range(d3.schemeBlues[9]);
}

function formatValue(value, attribute) {
    if (attribute === "MedianHomePrice" || attribute === "Median Household Income (2021)") {
        return value ? `$${d3.format(",.0f")(value)}` : "No data"; // Dollar sign with commas
    } else if (attribute === "Poverty" || attribute === "% of State Median HH Income") {
        return value ? `${d3.format(".1f")(value)}%` : "No data"; // Percent with 1 decimal
    } else {
        return value ? d3.format(",.0f")(value) : "No data"; // Commas for other values
    }
}

// Tooltip
var tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("padding", "10px")
    .style("background-color", "white")
    .style("border", "1px solid #ccc")
    .style("border-radius", "4px")
    .style("pointer-events", "none")
    .style("display", "none");
