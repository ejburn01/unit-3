(function () {

    var attrArray = ["dust_devil_count", "flash_flood_count", "flood_count", "funnel_cloud_count", "hail_count", "thunderstorm_wind_count"];
    var expressed = attrArray[4];

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

        //create Albers equal area conic projection centered on France
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

        };
    };

    function joinData(statesGeoJson, csvData) {
        //loop through csv to assign each set of csv attribute values to geojson region
        for (var i = 0; i < csvData.length; i++) {
            var csvRegion = csvData[i]; //the current region
            var csvKey = csvRegion.state_name; //the CSV primary key

            //loop through geojson regions to find correct region
            for (var a = 0; a < statesGeoJson.length; a++) {

                var geojsonProps = statesGeoJson[a].properties; //the current region geojson properties
                var geojsonKey = geojsonProps.STATE_NAME; //the geojson primary key

                //where primary keys match, transfer csv data to geojson properties object
                if (geojsonKey == csvKey) {

                    //assign all attributes and values
                    attrArray.forEach(function (attr) {
                        var val = parseFloat(csvRegion[attr]); //get csv attribute value
                        console.log(csvData[i], statesGeoJson[a], val)
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
                return "states " + d.properties.adm1_code;
            })
            .attr("d", path)
            .style("fill", function (d) {
                var value = d.properties[expressed];
                console.log(d.properties)
                if (value) {
                    return colorScale(d.properties[expressed]);
                } else {
                    return "#ccc";
                }
            });
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
        //chart frame dimensions
        var chartWidth = window.innerWidth * 0.425,
            chartHeight = 460;

        //create a second svg element to hold the bar chart
        var chart = d3.select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");

        //create a scale to size bars proportionally to frame
        max = d3.max(csvData, function (d) { return parseFloat(d[expressed]); })
        var yScale = d3.scaleLinear()
            .range([0, chartHeight])
            .domain([0, max]);

        //Example 2.4 line 8...set bars for each province
        var bars = chart.selectAll(".bars")
            .data(csvData)
            .enter()
            .append("rect")
            .sort(function (a, b) {
                return a[expressed] - b[expressed]
            })
            .attr("class", function (d) {
                return "bars " + d.state_name;
            })
            .attr("width", chartWidth / csvData.length - 1)
            .attr("x", function (d, i) {
                return i * (chartWidth / csvData.length);
            })
            .attr("height", function (d) {
                return yScale(parseFloat(d[expressed]));
            })
            .attr("y", function (d) {
                return chartHeight - yScale(parseFloat(d[expressed]));
            })
            .style("fill", function (d) {
                return colorScale(d[expressed]);
            });

        var numbers = chart.selectAll(".numbers")
            .data(csvData)
            .enter()
            .append("text")
            .sort(function (a, b) {
                return a[expressed] - b[expressed]
            })
            .attr("class", function (d) {
                return "numbers " + d.state_name
            })
            .attr("text-anchor", "middle")
            .attr("x", function (d, i) {
                var fraction = chartWidth / csvData.length;
                return i * fraction + (fraction - 1) / 2;
            })
            .attr("y", function (d) {
                return chartHeight - yScale(parseFloat(d[expressed])) + 15;
            })
            .text(function (d) {
                return d[expressed];
            });

        var chartTitle = chart.append("text")
            .attr("x", 20)
            .attr("y", 40)
            .attr("class", "chartTitle")
            .text(expressed.replace(/_/g, " ") + " in each state");
    };
})();