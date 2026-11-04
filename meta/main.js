
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));

  return data;
}

let data = await loadData();
console.log(data);


let commits = d3.groups(data, (d) => d.commit).map(([id, lines]) => {
  let first = lines[0];

  return {
    id,
    url: `https://github.com/vmarroquinguzman/portfolio/commit/${id}`,
    author: first.author,
    date: first.date,
    time: first.time,
    timezone: first.timezone,
    datetime: first.datetime,
    hourFrac: first.datetime.getHours() + first.datetime.getMinutes() / 60,
    totalLines: lines.length,
  };
});

console.log(commits);


function displayStats() {
  const stats = d3.select('#stats');

  const totalLOC = data.length;
  const totalCommits = commits.length;
  const totalFiles = new Set(data.map(d => d.file)).size;
  const averageLineLength = d3.mean(data, d => d.length);

  stats.html(`
    <h2>Summary Statistics</h2>
    <dl>
      <dt>Total Lines of Code</dt>
      <dd>${totalLOC}</dd>

      <dt>Total Commits</dt>
      <dd>${totalCommits}</dd>

      <dt>Total Files</dt>
      <dd>${totalFiles}</dd>

      <dt>Average Line Length</dt>
      <dd>${averageLineLength.toFixed(2)} characters</dd>
    </dl>
  `);
}

displayStats();


function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.style.left = `${event.clientX}px`;
  tooltip.style.top = `${event.clientY}px`;
}

function renderScatterPlot(data, commits) {
  // Define the dimensions of the chart
  const width = 1000;
  const height = 600;

  const margin = { top: 20, right: 20, bottom: 40, left: 50 };

  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  // Create the SVG
  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  // X-axis: Date of each commit
  const xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([0, width])
    .nice();

  // Y-axis: Time of day (0 to 24 hours)
  const yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([height, 0]);

  xScale.range([usableArea.left, usableArea.right]);
  yScale.range([usableArea.bottom, usableArea.top]);

  
  // Create horizontal gridlines
  const gridlines = svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`);

  gridlines.call(
    d3.axisLeft(yScale)
      .tickFormat('')
      .tickSize(-usableArea.width)
  );

  // Create the X-axis (commit dates)
  const xAxis = d3.axisBottom(xScale);

  svg
    .append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(xAxis);

  // Create the Y-axis (time of day)
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => `${d}:00`);

  svg
  .append('g')
  .attr('class', 'y-axis')
  .attr('transform', `translate(${usableArea.left}, 0)`)
  .call(yAxis);

  // Create a group for the dots
  const dots = svg.append('g').attr('class', 'dots');

  // Draw one circle for each commit
  dots
    .selectAll('circle')
    .data(commits)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', 5)
    .attr('fill', 'steelblue');
  
  function updateTooltipContent(commit) {
    const link = document.getElementById('commit-link');

    link.href = commit.url;
    link.textContent = commit.id.slice(0, 7);

    document.getElementById('commit-date').textContent =
      commit.datetime.toLocaleDateString();

    document.getElementById('commit-time').textContent =
      commit.datetime.toLocaleTimeString();

    document.getElementById('commit-author').textContent =
      commit.author;

    document.getElementById('commit-lines').textContent =
      commit.totalLines;
  }

  
dots
  .selectAll('circle')
  .on('mouseenter', (event, commit) => {
    updateTooltipContent(commit);
    updateTooltipVisibility(true);
    updateTooltipPosition(event);
  })
  .on('mouseleave', () => {
    updateTooltipVisibility(false);
  });

}

// Call the function
renderScatterPlot(data, commits);

