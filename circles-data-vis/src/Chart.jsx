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

      //Layout Compute Function
      const pack = (data) =>
        d3
          .pack()
          .size([width, height])
          .padding(1)
          .radius(
            (d) =>
              d.children?d.children.length:
              200
          )(
          d3.hierarchy(data)
          .sum(d => d.size)
          .sort((a, b) => b.size - a.size)
        );

      //Zoom Configuration
      const zoomConfig = d3
        .zoom()
        .extent([
          [0, 0],
          [width, height],
        ])
        .on("zoom", zoom);

      //Layout init
      const root = pack(data);
      //Get dynamic group name from gpt
      let Promises = [];
      root.each((d) => {
        d.data.name = d.data.name.split("[SEP]");
        Promises.push(getGroupNameGPT(d.data.name))
      });

      const groupNames = await Promise.allSettled(Promises);
      root.each((d, i) => (d.groupName = groupNames[i]?.value));
      let focus = root; 
      let view;

      //Color Assigning function
      const color = d3
        .scaleLinear()
        .domain([0, root.height])
        .range([
          "hsl(290.5882352941176, 100%, 90%)",
          "hsl(266, 100%, 59.411764705882355%)",
        ]);
      // .interpolate(d3.interpolateHsl)

      //Svg Element init
      const svg = d3
        .select("#chart")
        .append("svg")
        .attr("height", height)
        .attr("width", width)
        .attr("viewBox", `-${width / 2} -${height / 2} ${width} ${height}`)
        .style("display", "block")
        .style("border-radius", ".3rem")
        .style("margin", "0 -14px")
        .style("background", color(0))
        .style("cursor", "pointer");

      const tooltip = d3.select("#tooltip");
      tooltip.style("left", width + "px");

      //Circles Initial
      const node = svg
        .append("g")
        .selectAll("circle")
        .data(root.descendants().slice(1))
        .join("circle")
        .attr("fill", (d) => (d.children ? color(d.depth) : "white"))
        .style("fill-opacity", (d) => {
          if (d.parent === focus) {
            return 1;
          } else if (d.parent.depth === focus.depth - 1) {
            return 1;
          } else if (d.depth === focus.depth - 1) {
            return 1;
          } else {
            return 0;
          }
        })
        .attr("pointer-events", (d) => {
          if (!d.children) {
            return "none";
          } else if (d.depth >= focus.depth + 2) {
            return "none";
          } else {
            return null;
          }
        })
        .on("mouseover", function (e) {
          d3.select(this).attr("stroke", "#000");
          tooltip.select("#titles").text((d) =>
            d3
              .select(this)
              .datum()
              .data.children.map((el) => el.name)
              .flat()
              .splice(0, 5)
              .join(", ")
          );
        })
        .on("mouseout", function () {
          d3.select(this).attr("stroke", null);
        });
      node.call(zoomConfig);

      //Labels Initial
      const label = svg
        .append("g")
        .style("font", "10px sans-serif")
        .attr("pointer-events", "none")
        .attr("text-anchor", "middle")
        .selectAll("text")
        .data(root.descendants())
        .join(
          (enter) =>
            enter.append("text").text((d, i) => {
              return d.groupName || "Group Name";
            }),
          (update) => update,
          (exit) => exit.remove()
        )
        .style("fill-opacity", (d) => (d.parent === root ? 1 : 0))
        .style("display", (d) => (d.parent === root ? "inline" : "none"))
        .attr("id", (d, i) => `group${i}`);

      //Display Initial
      zoomTo([root.x, root.y, root.r * 3]);

      //Zoom transition
      function zoomTo(v) {
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

      //Zoom Event Handler
      function zoom(event, d) {
        const focus0 = focus;
        event.sourceEvent.preventDefault();
        if (event.sourceEvent.deltaY < 0) {
          focus = d.parent;
        } else if (event.sourceEvent.deltaY > 0) {
          focus = d;
        } else if (focus !== d) {
          focus = d;
        }

        const transition = svg
          .transition()
          .duration(event.altKey ? 7500 : 500)
          .tween("zoom", (d) => {
            const i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
            return (t) => zoomTo(i(t));
          });

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

        node
          .attr("pointer-events", (d) => {
            if (!d.children) {
              return "none";
            } else if (d.depth >= focus.depth + 2) {
              return "none";
            } else {
              return null;
            }
          })
          .transition(transition)
          .style("fill-opacity", (d) => {
            if (d.parent === focus) {
              return 1;
            } else if (d.parent.depth === focus.depth - 1) {
              return 1;
            } else if (d.depth === focus.depth - 1) {
              return 1;
            } else {
              return 0;
            }
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

  const Key = import.meta.env.VITE_OPENAI_KEY;
  console.log(import.meta.env.MODE);
  console.log(import.meta.env);
  console.log(import.meta.env.BASE_URL);
  console.log(Key);
  console.log(Key.substring(1,Key.length-1));

  const getGroupNameGPT = async (NameList) => {
    try {
      // event.preventDefault();
      // Make a request to ChatGPT
      const response = await fetch("https://api.openai.com/v1/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: Key.substring(1,Key.length-1),
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
