(function () {

    var attrArray = ["dust_devil_count", "flash_flood_count", "flood_count", "funnel_cloud_count", "hail_count", "thunderstorm_wind_count"];
    var attrArrayNoSpace = ["dust devil count", "flash flood count", "flood count", "funnel cloud count", "hail count", "thunderstorm wind count"];
    var expressed = attrArray[0];
    var domainDict = { "dust_devil_count": 4, "flash_flood_count": 2228, "flood_count": 2095, "funnel_cloud_count": 360, "hail_count": 9961, "thunderstorm_wind_count": 17885 }

    //chart frame dimensions
    var chartWidth = window.innerWidth * 0.425,
        chartHeight = 473,
        leftPadding = 40,
        rightPadding = 2,
        topBottomPadding = 5,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

    //create a scale to size bars proportionally to frame and for axis
    //max = d3.max(csvData, function (d) { return parseFloat(d[expressed]); })
    var yScale = d3.scaleLinear()
        .range([463, 0])
        .domain([0, domainDict[expressed]]);

    //execute script when window is loaded
    window.onload = setMap();

    //set up choropleth map
    function setMap() {
        //map frame dimensions
        var width = window.innerWidth * 0.5,
            height = 460;

        //create new svg container for the map
        var map = d3.select("body")
            .append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height);

        var projection = d3.geoAlbers()
            .center([0, 32.9])
            .rotate([85.30, 0, 0])
            .parallels([29.5, 45.5])
            .scale(1600)
            .translate([width / 2, height / 2]);

        var path = d3.geoPath()
            .projection(projection);

        //use Promise.all to parallelize asynchronous data loading
        var promises = [d3.csv("data/Southwest_point_disaster_geom.csv"),
        d3.json("data/Southwest_states.topojson"),
        d3.json("data/NorthAmerica10m.topojson")
        ];
        Promise.all(promises).then(callback);

        function callback(data) {
            csvData = data[0];
            states = data[1];
            countries = data[2];

            setGraticule(map, path);

            var statesGeoJson = topojson.feature(states, states.objects.Southwest_states).features,
                countriesGeoJson = topojson.feature(countries, countries.objects.NorthAmerica10m);

            var countriesMapped = map.append("path")
                .datum(countriesGeoJson)
                .attr("class", "countries")
                .attr("d", path);

            //console.log(statesGeoJson)
            statesGeoJson = joinData(statesGeoJson, csvData);

            var colorScale = makeColorScale(csvData);

            setEnumerationUnits(statesGeoJson, map, path, colorScale);

            setChart(csvData, colorScale);

            createDropdown(csvData);
        };
    };

    function joinData(statesGeoJson, csvData) {
        //loop through csv to assign each set of csv attribute values to geojson region
        for (var i = 0; i < csvData.length; i++) {
            var csvRegion = csvData[i]; //the current region
            var csvKey = csvRegion.STATE_NAME; //the CSV primary key

            //loop through geojson regions to find correct region
            for (var a = 0; a < statesGeoJson.length; a++) {

                var geojsonProps = statesGeoJson[a].properties; //the current region geojson properties
                var geojsonKey = geojsonProps.STATE_NAME; //the geojson primary key

                //where primary keys match, transfer csv data to geojson properties object
                if (geojsonKey == csvKey) {

                    //assign all attributes and values
                    attrArray.forEach(function (attr) {
                        var val = parseFloat(csvRegion[attr]); //get csv attribute value
                        //console.log(csvData[i], statesGeoJson[a], val)
                        geojsonProps[attr] = val; //assign attribute and value to geojson properties
                    });
                };
            };
        };
        return statesGeoJson
    };

    function setGraticule(map, path) {
        //create graticule generator
        var graticule = d3.geoGraticule()
            .step([5, 5]); //place graticule lines every 5 degrees of longitude and latitude

        //create graticule background
        var gratBackground = map.append("path")
            .datum(graticule.outline()) //bind graticule background
            .attr("class", "gratBackground") //assign class for styling
            .attr("d", path) //project graticule

        //create graticule lines
        var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
            .data(graticule.lines()) //bind graticule lines to each element to be created
            .enter() //create an element for each datum
            .append("path") //append each element to the svg as a path element
            .attr("class", "gratLines") //assign class for styling
            .attr("d", path); //project graticule lines
    };

    function setEnumerationUnits(statesGeoJson, map, path, colorScale) {
        var statesMapped = map.selectAll(".states")
            .data(statesGeoJson)
            .enter()
            .append("path")
            .attr("class", function (d) {
                var state_name = d.properties.STATE_NAME.split(' ').join('_');
                return "states " + state_name;
            })
            .attr("d", path)
            .style("fill", function (d) {
                var value = d.properties[expressed];
                //console.log(d.properties)
                if (value) {
                    return colorScale(d.properties[expressed]);
                } else {
                    return "#ccc";
                }
            })
            .on("mouseover", function (event, d) {
                highlight(d.properties);
            })
            .on("mouseout", function (event, d) {
                dehighlight(d.properties);
            })
            .on("mousemove", moveLabel);
        var desc = statesMapped.append("desc")
            .text('{"stroke": "#000", "stroke-width": "0.5px"}');
    };

    function makeColorScale(data) {
        var colorClasses = [
            "#D4B9DA",
            "#C994C7",
            "#DF65B0",
            "#DD1C77",
            "#980043"
        ];

        //create color scale generator
        var colorScale = d3.scaleQuantile()
            .range(colorClasses);

        //build two-value array of minimum and maximum expressed attribute values
        var minmax = [
            d3.min(data, function (d) { return parseFloat(d[expressed]); }),
            d3.max(data, function (d) { return parseFloat(d[expressed]); })
        ];
        //assign two-value array as scale domain
        colorScale.domain(minmax);

        return colorScale;
    };

    function setChart(csvData, colorScale) {

        //create a second svg element to hold the bar chart
        var chart = d3.select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");

        //Example 2.4 line 8...set bars for each province
        var bars = chart.selectAll(".bar")
            .data(csvData)
            .enter()
            .append("rect")
            .sort(function (a, b) {
                return b[expressed] - a[expressed]
            })
            .attr("class", function (d) {
                var state_name = d.STATE_NAME.split(' ').join('_');
                return "bar " + state_name;
            })
            .attr("width", chartInnerWidth / csvData.length - 1)
            .on("mouseover", function (event, d) {
                //console.log(d)
                highlight(d);
            })
            .on("mouseout", function (event, d) {
                dehighlight(d);
            })
            .on("mousemove", moveLabel);
        var desc = bars.append("desc")
            .text('{"stroke": "none", "stroke-width": "0px"}');

        //create a text element for the chart title
        var chartTitle = chart.append("text")
            .attr("x", 200)
            .attr("y", 40)
            .attr("class", "chartTitle")
            .text(expressed.replace(/_/g, " ") + " in each state");

        //create vertical axis generator
        var yAxis = d3.axisLeft()
            .scale(yScale);

        //place axis
        var axis = chart.append("g")
            .attr("class", "axis")
            .attr("transform", translate)
            .call(yAxis);

        //create frame for chart border
        var chartFrame = chart.append("rect")
            .attr("class", "chartFrame")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

    };

    //function to create a dropdown menu for attribute selection
    function createDropdown(csvData) {
        //add select element
        var dropdown = d3.select("body")
            .append("select")
            .attr("class", "dropdown")
            .on("change", function () {
                changeAttribute(this.value, csvData)
            });

        //add initial option
        var titleOption = dropdown.append("option")
            .attr("class", "titleOption")
            .attr("disabled", "true")
            .text("Select Attribute");

        //add attribute name options
        var attrOptions = dropdown.selectAll("attrOptions")
            .data(attrArray)
            .enter()
            .append("option")
            .attr("value", function (d) { return d })
            .text(function (d) { return d.replace(/_/g, " ") });
    };

    //dropdown change event handler
    function changeAttribute(attribute, csvData) {
        //change the expressed attribute
        expressed = attribute;

        yScale = d3.scaleLinear()
            .range([463, 0])
            .domain([0, domainDict[expressed]]);

        //recreate the color scale
        var colorScale = makeColorScale(csvData);

        //recolor enumeration units
        var states = d3.selectAll(".states")
            .transition()
            .duration(1000)
            .style("fill", function (d) {
                var value = d.properties[expressed];
                if (value) {
                    return colorScale(d.properties[expressed]);
                } else {
                    return "#ccc";
                }
            });
        var bars = d3.selectAll(".bar")
            //Sort bars
            .sort(function (a, b) {
                return b[expressed] - a[expressed];
            })
            .transition() //add animation
            .delay(function (d, i) {
                return i * 20
            })
            .duration(500)
            .attr("x", function (d, i) {
                return i * (chartInnerWidth / csvData.length) + leftPadding;
            })
            //resize bars
            .attr("height", function (d, i) {
                //console.log(expressed)
                return 463 - yScale(parseFloat(d[expressed]));
            })
            .attr("y", function (d, i) {
                return yScale(parseFloat(d[expressed])) + topBottomPadding;
            })
            //recolor bars
            .style("fill", function (d) {
                var value = d[expressed];
                if (value) {
                    return colorScale(value);
                } else {
                    return "#ccc";
                }
            })

        updateChart(bars, csvData.length, colorScale);
    }
    function updateChart(bars, n, colorScale) {
        //position bars
        bars.attr("x", function (d, i) {
            return i * (chartInnerWidth / n) + leftPadding;
        })
            //size/resize bars
            .attr("height", function (d, i) {
                return 463 - yScale(parseFloat(d[expressed]));
            })
            .attr("y", function (d, i) {
                return yScale(parseFloat(d[expressed])) + topBottomPadding;
            })
            //color/recolor bars
            .style("fill", function (d) {
                var value = d[expressed];
                if (value) {
                    return colorScale(value);
                } else {
                    return "#ccc";
                }
            });
        var chartTitle = d3.select(".chartTitle")
            .text(expressed.replace(/_/g, " ") + " in each state");

        var yAxis = d3.axisLeft()
            .scale(yScale);

        var axis = d3.select(".axis")
            .attr("class", "axis")
            .attr("transform", translate)
            .call(yAxis);
    };

    //function to highlight enumeration units and bars
    function highlight(props) {
        //console.log("362", props)
        //change stroke
        var state_name = props.STATE_NAME.split(' ').join('_');
        var selected = d3.selectAll("." + state_name)
            .style("stroke", "blue")
            .style("stroke-width", "2");
        setLabel(props);
    };
    //function to reset the element style on mouseout
    function dehighlight(props) {
        d3.select(".infolabel")
            .remove();
        var state_name = props.STATE_NAME.split(' ').join('_');
        var selected = d3.selectAll("." + state_name)
            .style("stroke", function () {
                return getStyle(this, "stroke")
            })
            .style("stroke-width", function () {
                return getStyle(this, "stroke-width")
            });

        function getStyle(element, styleName) {
            var styleText = d3.select(element)
                .select("desc")
                .text();

            var styleObject = JSON.parse(styleText);

            return styleObject[styleName];
        };
    };
    //function to create dynamic label
    function setLabel(props) {
        //label content
        var labelAttribute = "<h1>" + props[expressed] +
            "</h1><b>" + expressed.split('_').join(' ') + "</b>";

        //create info label div
        var infolabel = d3.select("body")
            .append("div")
            .attr("class", "infolabel")
            .attr("id", props.STATE_NAME + "_label")
            .html(labelAttribute);

        var stateName = infolabel.append("div")
            .attr("class", "labelname")
            .html(props.STATE_NAME);
    };

    //function to move info label with mouse
    function moveLabel(){
        //get width of label
        var labelWidth = d3.select(".infolabel")
            .node()
            .getBoundingClientRect()
            .width;
    
        //use coordinates of mousemove event to set label coordinates
        var x1 = event.clientX + 10,
            y1 = event.clientY - 75,
            x2 = event.clientX - labelWidth - 10,
            y2 = event.clientY + 25;
    
        //horizontal label coordinate, testing for overflow
        var x = event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
        //vertical label coordinate, testing for overflow
        var y = event.clientY < 75 ? y2 : y1; 
    
        d3.select(".infolabel")
            .style("left", x + "px")
            .style("top", y + "px");
    };
})();