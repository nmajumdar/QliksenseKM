define(["jquery", "text!./kaplanMeier.css","./d3.min"], function($, cssContent) {
	'use strict';
	$("<style>").html(cssContent).appendTo("head");
	return {
		initialProperties : {
			qHyperCubeDef : {
				qDimensions : [],
				qMeasures : [],
				qInitialDataFetch : [{
					qWidth : 13,
					qHeight : 769
				}]
			},
			selectionMode : "CONFIRM"
		},
		definition : {
			type : "items",
			component : "accordion",
			items : {
				dimensions : {
					uses : "dimensions",
					min : 1,
					max : 1
				},
				measures : {
					uses : "measures",
					min : 2,
					max : 12
				},
				sorting : {
					uses : "sorting"
				},
				settings : {
					uses : "settings",
					items : {
						chartProperties: {
							type: "items",
							label: "Chart Configuration",
							items: {
								conversion: {
									ref: "conversion",
									label: "Measure-to-Dimension Conversion",
									type: "integer",
									component: "dropdown",
									options: [{
										value: 1,
										label: "Days"
									}, {
										value: 7,
										label: "Weeks"									
									}, {
										value: 30,
										label: "Months"
									}, {
										value: 365,
										label: "Years"
									}
									],
									defaultValue: 30
								}
							}
						}
					}
				}
			}
		},
		snapshot : {
			canTakeSnapshot : true
		},
		paint : function($element,layout) {
			var fullHyperCube = [];
			var lastrow = 0;
			this.backendApi.eachDataRow( function ( rownum, row ) {
				lastrow = rownum;
				fullHyperCube.push(row);
			});
			if(this.backendApi.getRowCount() > lastrow +1){
             //we havent got all the rows yet, so get some more, 500 rows
              var requestPage = [{
                    qTop: lastrow + 1,
                    qLeft: 0,
                    qWidth: 13, //should be # of columns
                    qHeight: Math.min( 769, this.backendApi.getRowCount() - lastrow )
                }];
               this.backendApi.getData( requestPage ).then( function ( dataPages ) {
				   dataPages[0].qMatrix.forEach(function(item){
					 fullHyperCube.push(item);
					 lastrow++;
				   }
				   );
               } );
			}
			
			var thisMatrix = layout.qHyperCube.qDataPages[0].qMatrix;
			// create a new array that contains the measure measureLabels
			var measureLabels = layout.qHyperCube.qMeasureInfo.map(function(d) {
				return d.qFallbackTitle;
			});
			
			var dimensionLabels = layout.qHyperCube.qDimensionInfo.map(function(d) {
			   return d.qFallbackTitle;
		    });
			
			var width = $element.width();
			var height = $element.height();
			var id = "container_" + layout.qInfo.qId;
			
			if (document.getElementById(id)) {
				$("#" + id).empty();
			}
			else {
				$element.append($('<div />;').attr("id", id).width(width).height(height));
			}
		   
			kmViz(width,height,id,measureLabels,fullHyperCube,layout);
		}
	};
});

var kmViz = function(width,height,id,measureLabels,qMatrix,layout) {
	var color = d3.scale.category10();
	
	var numMeasures = qMatrix[0].length;
	var numNotPathOrCensors = 1;
	//Number of lines to draw
	var numPaths = Math.floor((numMeasures - numNotPathOrCensors)/2);
	//Used to skip measures that don't draw lines
	var numUncounted = numNotPathOrCensors + numPaths - 1;
	//Conversion between dimension precision and kaplan-meier step precision. Dimension Precision = Step Precision / Conversion
	var conversion = layout.conversion;
	function getConvLabel(layout) {
		switch(layout) {
			case 1:
				return "Days";
			case 7:
				return "Weeks";
			case 30:
				return "Months";
			case 365:
				return "Years";
		}
	}
	var conversionLabel = getConvLabel(layout.conversion);
	
	var margin = {top: 20, right: 20, bottom: 30, left: 50},
		width = width - margin.left - margin.right,
		height = height - margin.top - margin.bottom;

	var tickvalues = [], l = qMatrix.length, i;
	var actualTickValues = [];
	for(i=0; i<l; i++) {
		var dimValue = qMatrix[i][0].qText;
		tickvalues.push(dimValue);
		if (dimValue % conversion == 0)
			actualTickValues.push(dimValue);
	};

	var legendSize = 0;
	for (var i = numUncounted; i < measureLabels.length; i++){
		if (measureLabels[i].length > legendSize)
			legendSize = measureLabels[i].length;
	}
	legendSize = legendSize * 8 + 24;
	
	var x = d3.scale.ordinal()
		.domain(tickvalues)
		.rangePoints([0, width - legendSize]);
		
	var y = d3.scale.linear()
	.domain([0, 1])
	.range([height, 0]);
	
	var xAxis = d3.svg.axis()
	.scale(x)
	.tickValues(actualTickValues)
	.tickFormat(function(d){
		return Math.floor(d/conversion);
	}
	)
	.orient("bottom");

	var yAxis = d3.svg.axis()
		.scale(y)
		.orient("left")
		.ticks(5);
	
	var div = d3.select("#"+id).append("div")
		.attr("class","tooltip")
		.style("opacity",0);

	var svg = d3.select("#"+id).append("svg")
		.attr("width", width + margin.left + margin.right)
		.attr("height", height + margin.top + margin.bottom)
		.append("g")
		.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

	svg.append("g")
	  .attr("class", "x axis")
	  .attr("transform", "translate(0," + height + ")")
	  .call(xAxis);

	svg.append("g")
	  .attr("class", "y axis")
	  .call(yAxis);
		
	// Draw paths for data underneath mouse-tracking canvas
	for (var i = numUncounted+1; i < numMeasures; i++){
		var lineColor = color(measureLabels[i-1]);
		
		if (qMatrix[0][i].qNum <= 0)
			continue;
		
		var line = d3.svg.area()
		.x(function(d) { return x(d[0].qText); })
		.y(function(d) { return y(d[i].qNum); });

		line.interpolate('step-after');
		
		svg.append("path")
			.datum(qMatrix)
			.attr("class", "line")
			.attr("d", line)
			.attr("stroke",lineColor);
	}
	
	// Draw symbols for censor data
	var lowerCensorLimit = 0;
	
	for (var i = 0; i < numPaths; i++){
		svg.selectAll("censorMark")
			.data(qMatrix)
			.enter().append("line")
			.filter(function(d) { return d[numNotPathOrCensors+i].qNum > lowerCensorLimit && d[numNotPathOrCensors+i+numPaths].qNum > 0; })
				.attr("x1",function(d) { return x(d[0].qText); })
				.attr("y1",function(d) { return y(d[numNotPathOrCensors+i+numPaths].qNum); })
				.attr("x2",function(d) { return x(d[0].qText); })
				.attr("y2",function(d) { return y(d[numNotPathOrCensors+i+numPaths].qNum) - 6; })
				.attr("stroke",function(d) { return color(measureLabels[i+numUncounted]); })
				.style("opacity",.7);
	}
		
	//Circle and Line Tracking
	var valueline = d3.svg.line()
    .x(function(d) { return x(d[0].qText); })
    .y(function(d) { return y(d[numUncounted+1].qNum); });
	
	var lineSvg = svg.append("g");
		
	 lineSvg.append("path")
        .attr("class", "line")
        .attr("d", valueline(qMatrix));
	
	var focii = [];
	for (var i = numUncounted+1; i < numMeasures; i++){
		var focus = svg.append("g")
		.style("display", "none");
	
		focus.append("circle") 
			.attr("class", "y")
			.style("fill", "none") 
			.style("stroke", "blue")
			.attr("r", 4);
			
		if (i == numUncounted+1) {
			focus.append("line")
				.attr("class", "x")
				.style("stroke", "blue")
				.style("stroke-dasharray", "3,3")
				.style("opacity", 0.5)
				.attr("y1", 0)
				.attr("y2", height);
		}
			
		focii.push(focus);
	}
		
	svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .style("fill", "none")
        .style("pointer-events", "all")
		.on("mouseover", trackMouseover)
		.on("mouseout", trackMouseout)
        .on("mousemove", mousemove);
		
	function trackMouseover(){
		focii.forEach(function(focusEntry) {
				focusEntry.style("display", null); 
			}
		);
		div.transition()        
				.duration(200)      
				.style("opacity", .9);  
	}
	
	function trackMouseout(){
		focii.forEach(function(focusEntry) {
				focusEntry.style("display", "none"); 
			}
		);
		div.transition()        
			.duration(500)      
			.style("opacity", 0); 
	}
	
	function mousemove() {  
		var totalCensors = 0;
		
        var x0 = d3.mouse(this)[0];

		var leftEdges = x.range();
        var xWidth = x.rangeBand();
        var j;
        for(j=0; x0 > (leftEdges[j] + xWidth); j++) {}        
		
		x0 = x.domain()[j];
		
		//var i = j;
		var i = 0;
		for (i = 0; i < l && qMatrix[i][0].qText < Math.floor(x0/conversion)*conversion+1; i++) {}
        var d0 = qMatrix[i - 1],
            d = i == 0 ? qMatrix[0] : d0
			d = i == l - 1 ? qMatrix[l-1] : d0;
			
		for (var abcd = 0; abcd < qMatrix.length && qMatrix[abcd][0].qText <= Math.floor(x0/conversion)*conversion+conversion; abcd++){
			for (var cdef = 0; cdef < numPaths; cdef++){
				totalCensors += qMatrix[abcd][numNotPathOrCensors+cdef].qNum;
			}
		}

		var maxMeasure = 0;
		var tooltipRows = "<table class=\"tooltipTable\" align=\"left\"><tr><td class=\"dimHeader\">" + conversionLabel + " Elapsed</td><td class=\"dimHeader\" align=\"right\">" + Math.floor(d[0].qText/conversion) + "</td></tr><tr><td class=\"dataHeader\">Dimensions</td><td class=\"dataHeader\" align=\"right\">% Remaining</td></tr>"
		for (var i = numUncounted+1; i < numMeasures; i++){
			focii[i-numUncounted-1].select("circle.y")
				.attr("transform", 
                  "translate(" + x(d[0].qText) + "," + 
                                 y(d[i].qNum) + ")");
			
			if (d[i].qNum > maxMeasure)
				maxMeasure = d[i].qNum;
			
			tooltipRows += "<tr><td>" + measureLabels[i-1] + "</td><td align=\"right\">" + d3.format(".1f")(d[i].qNum * 100) + "</td></tr>";
		}
		
		tooltipRows += "<tr><td class=\"surplusHeader\" colspan=\"2\">Additional Information</td></tr><tr><td class=\"endData\">Cumulative Censorship</td><td class=\"endData\" align=\"right\">" + totalCensors + "</td></tr></table>"
		
		focii[0].select(".x")
			.attr("transform",
            "translate(" + x(d[0].qText) + "," +
                           y(maxMeasure) + ")")
            .attr("y2", height - y(maxMeasure));
			
			
		div.html(tooltipRows);
			
		var distToEndX = width - d3.mouse(this)[0];
		var distToEndY = d3.mouse(this)[1];
		var tooltipWidth = div.node().getBoundingClientRect().width / 2;
		var tooltipHeight = div.node().getBoundingClientRect().height;
		var xOffset = distToEndX < tooltipWidth * 2 ? distToEndX - tooltipWidth : tooltipWidth;
		var yOffset = distToEndY < tooltipHeight ? distToEndY : tooltipHeight;
		div.style("left", d3.mouse(this)[0] + xOffset - margin.left + "px")     
			.style("top", d3.mouse(this)[1] - yOffset + margin.top + "px");

    } 
	
	// Legend
	var legend = svg.selectAll(".legend")
          .data(color.domain())
		  .enter().append("g")
          .attr("class", "legend")
          .attr("transform", function(d, i) { return "translate(0," + i * 20 + ")"; });
 
	legend.append("rect")
	  .attr("x", width - 18)
	  .attr("width", 18)
	  .attr("height", 18)
	  .style("fill", color);

	legend.append("text")
	  .attr("x", width - 24)
	  .attr("y", 9)
	  .style("font-size","14px")
	  .attr("dy", ".35em")
	  .style("text-anchor", "end")
	  .text(function(d) { return d; });	
};
