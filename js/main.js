//execute script when window is loaded
window.onload = setMap();

//set up choropleth map
function setMap(){
    //map frame dimensions
    var width = 960,
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
        .scale(1643)
        .translate([width / 2, height / 2]);

    var path = d3.geoPath()
        .projection(projection);

    //use Promise.all to parallelize asynchronous data loading
    var promises = [d3.csv("data/Southwest_point_disaster_geom.csv"),                    
                    d3.json("data/Southwest_states.topojson"),
                    d3.json("data/NorthAmerica10m.topojson")                 
                    ];    
    Promise.all(promises).then(callback);

function callback(data){    
    csvData = data[0];    
    states = data[1];
    countries = data[2];
            
    console.log(csvData);
    console.log(states);

    var statesGeoJson = topojson.feature(states, states.objects.Southwest_states).features,
        countriesGeoJson = topojson.feature(countries, countries.objects.NorthAmerica10m);
    console.log(statesGeoJson);
    console.log(countriesGeoJson);

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

    var countriesMapped = map.append("path")
            .datum(countriesGeoJson)
            .attr("class", "countries")
            .attr("d", path);   
            
    var statesMapped = map.selectAll(".states")
        .data(statesGeoJson)
        .enter()
        .append("path")
        .attr("class", function(d){
            return "regions " + d.properties.adm1_code;
        })
        .attr("d", path);
    };
};