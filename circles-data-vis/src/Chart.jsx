import * as d3 from "d3";
import React, { useEffect, useRef } from "react";
import data2 from "./assets/db.json";

const Chart = () => {
  useEffect(() => {
    async function draw() {
      // Set up the dimensions of the chart
      const width = 700;
      const height = 700;

      //Data Fetch local json server
      const data = data2;
      data.size = 161;

      //Layout Compute Function
      const pack = (data) =>
        d3.pack().size([width, height]).padding(2)(
          d3
            .hierarchy(data)
            .sum((d) => d.size)
            .sort((a, b) => b.value - a.value)
        );

      //Zoom Configuration

      //Layout init
      const root = pack(data);
      let focus = root;
      let view;

      function handleReset (event) {
        event.preventDefault()
        zoom(event,root)
      }

      const zoomConfig = d3
        .zoom()
        .extent([
          [0, 0],
          [width, height],
        ])
        .on("zoom", zoom);

      //Color Assigning function
      const color = d3
        .scaleLinear()
        .domain([0, root.height])
        .range([
          "hsl(290.5882352941176, 100%, 90%)",
          "hsl(266, 100%, 59.411764705882355%)",
        ]);

      //Svg Element init
      const svg = d3
        .select("#chart")
        .append("svg")
        .attr("height", height)
        .attr("width", width)
        // .attr("viewBox", `-${width / 2} -${height / 2} ${width} ${height}`)
        .style("display", "block")
        .style("background", color(0))
        .style("cursor", "pointer");
      // .call(zoomConfig)

      const tooltip = d3.select("#tooltip");
      tooltip.style("left", "100%");

      const innerSpace = svg
        .append("g")
        .classed("inner_space", true)
        .call(zoomConfig);

      innerSpace
        .append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "transparent");
      //Circles Initial
      const node = innerSpace
        .append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`)
        .selectAll("circle")
        .data(root.descendants().slice(1))
        .join("circle")
        .attr("fill", (d) => (d.children ? color(d.depth) : "white"))
        .attr("pointer-events", (d) => (!d.children ? "none" : null))
        // .call(zoomConfig)
        .on("mouseover", function () {
          d3.select(this).attr("stroke", "#000");
        })
        .on("mouseout", function () {
          d3.select(this).attr("stroke", null);
        })
        .on(
          "click",
          (event, d) => focus !== d && (zoom(event, d), event.stopPropagation())
        );

      const label = innerSpace
        .append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`)
        .style("font", "10px sans-serif")
        .attr("pointer-events", "none")
        .attr("text-anchor", "middle")
        .selectAll("text")
        .data(root.descendants())
        .join("text")
        .style("fill-opacity", (d) => (d.parent === root ? 1 : 0))
        .style("display", (d) => (d.parent === root ? "inline" : "none"))
        .text((d) => "Group Name");

      const resetBtn = d3.select("#chart")
      .append("button")
      .text('Reset')
      .on('click',handleReset)
      
      //Display Initial

      zoomTo([root.x, root.y, root.r * 2]);

      //Zoom transition
      function zoomTo(v) {
        console.log("🚀 ~ file: Chart.jsx:113 ~ zoomTo ~ v:", v);
        const k = width / v[2];

        view = v;

        label.attr(
          "transform",
          (d) => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`
        );
        node.attr(
          "transform",
          (d) => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`
        );
        node.attr("r", (d) => d.r * k);
      }

      function zoom(event, d) {
        const focus0 = focus;

        focus = d;

        innerSpace.attr("transform", event.transform);

        const transition = innerSpace
          .transition()
          .duration(event.altKey ? 7500 : 750);
        // .tween("zoom", (d) => {
        //   const i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
        //   return (t) => zoomTo(i(t),event.transform);
        // });

        label
          .filter(function (d) {
            return d.parent === focus || this.style.display === "inline";
          })
          .transition(transition)
          .style("fill-opacity", (d) => (d.parent === focus ? 1 : 0))
          .on("start", function (d) {
            if (d.parent === focus) this.style.display = "inline";
          })
          .on("end", function (d) {
            if (d.parent !== focus) this.style.display = "none";
          });
      }
    }
    draw();
    return () => {
      return null;
    };
  }, []);

  const titleSpan = useRef(null);

  function handleDownload(e) {
    const blob = new Blob([titleSpan.current.innerText], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    e.target.href = url;
  }

  const Key = import.meta.env.VITE_KEY;
  console.log(import.meta.env.MODE);
  console.log(import.meta.env.BASE_URL);

  const getGroupNameGPT = async (NameList) => {
    try {
      // event.preventDefault();
      // Make a request to ChatGPT
      const response = await fetch("https://api.openai.com/v1/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: Key,
        },
        body: JSON.stringify({
          model: "text-davinci-003",
          prompt: `Can you suggest a name for the provided group of job titles: ${NameList}?`,
          max_tokens: 16,
          temperature: 0.1,
          n: 1,
        }),
      });

      // Get the suggested name from the response
      const data = await response.json();
      const name = data.choices[0].text.trim();
      return name;
    } catch (err) {
      return console.error(err);
    }
  };

  return (
    <div id="chart">
      <div id="tooltip">
        <b>Titles: </b>
        <p ref={titleSpan} id="titles"></p>
        <div>
          <a href="" onClick={handleDownload} download="Titles.csv">
            Export
          </a>
        </div>
      </div>
    </div>
  );
};

export default Chart;
